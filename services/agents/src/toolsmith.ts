/**
 * Toolsmith Agent
 * Creates and manages deterministic tools for the agent system
 */

import type { AgentType } from '@mother-harness/shared';
import { getLLMClient, getToolRegistry } from '@mother-harness/shared';
import { BaseAgent, type AgentContext, type AgentResult } from './base-agent.js';
import { nanoid } from 'nanoid';

/** Tool definition */
interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    return_type: string;
    implementation: string;
    examples: string[];
}

const TOOLSMITH_SYSTEM_PROMPT = `You are an expert tool developer. Your role is to:
1. Create well-designed, reusable tools
2. Follow deterministic patterns - same input = same output
3. Include proper error handling and validation
4. Write clear documentation and examples
5. Ensure tools are safe and sandboxed

Tools should be atomic, focused, and composable.`;

const TOOL_DESIGN_PROMPT = `Design a deterministic tool based on this request:

Request: {request}
Context: {context}

Return a JSON object:
{
  "name": "tool_name_in_snake_case",
  "description": "Clear description of what the tool does",
  "parameters": {
    "param_name": {
      "type": "string/number/boolean/array/object",
      "description": "what this parameter is for",
      "required": true/false,
      "default": "default value if any"
    }
  },
  "return_type": "description of return value",
  "implementation": "TypeScript function body (will be wrapped in async function)",
  "examples": [
    "Example usage 1",
    "Example usage 2"
  ],
  "test_cases": [
    { "input": {}, "expected_output": {} }
  ]
}

The implementation should be pure TypeScript that can run in a sandboxed environment.
Available in scope: console, JSON, Math, Date, String, Array, Object.`;

export class ToolsmithAgent extends BaseAgent {
    readonly agentType: AgentType = 'toolsmith';
    private llm = getLLMClient();

    protected async run(inputs: string, context: AgentContext): Promise<AgentResult> {
        const startTime = Date.now();

        // Design the tool
        const design = await this.designTool(inputs, context);

        if (!design.tool) {
            return {
                success: false,
                outputs: { error: 'Failed to design tool' },
                explanation: 'Tool design failed',
                tokens_used: design.tokens,
                duration_ms: Date.now() - startTime,
            };
        }

        // Validate the tool
        const validation = await this.validateTool(design.tool);

        // Register if valid
        if (validation.valid) {
            await this.registerTool(design.tool);
        }

        return {
            success: validation.valid,
            outputs: {
                tool: design.tool,
                validation: validation,
                registered: validation.valid,
            },
            explanation: validation.valid
                ? `Created and registered tool "${design.tool.name}"`
                : `Tool design has issues: ${validation.issues.join(', ')}`,
            artifacts: validation.valid ? [design.tool.name] : [],
            tokens_used: design.tokens,
            duration_ms: Date.now() - startTime,
        };
    }

    private async designTool(
        request: string,
        context: AgentContext
    ): Promise<{ tool: ToolDefinition | null; tokens: number }> {
        const prompt = TOOL_DESIGN_PROMPT
            .replace('{request}', request)
            .replace('{context}', context.recent_context ?? 'No additional context');

        const result = await this.llm.json<ToolDefinition>(prompt, {
            system: TOOLSMITH_SYSTEM_PROMPT,
            temperature: 0.3,
            max_tokens: 4096,
        });

        if (result.data && result.data.name && result.data.implementation) {
            return {
                tool: result.data,
                tokens: result.raw.tokens_used.total,
            };
        }

        return { tool: null, tokens: result.raw.tokens_used.total };
    }

    private async validateTool(
        tool: ToolDefinition
    ): Promise<{ valid: boolean; issues: string[] }> {
        const issues: string[] = [];

        // Name validation
        if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
            issues.push('Tool name must be snake_case starting with a letter');
        }

        // Description validation
        if (!tool.description || tool.description.length < 10) {
            issues.push('Description must be at least 10 characters');
        }

        // Implementation validation
        if (!tool.implementation || tool.implementation.length < 5) {
            issues.push('Implementation is missing or too short');
        }

        // Check for unsafe patterns
        const unsafePatterns = [
            /eval\s*\(/,
            /Function\s*\(/,
            /import\s+/,
            /require\s*\(/,
            /process\./,
            /fs\./,
            /child_process/,
            /exec\s*\(/,
        ];

        for (const pattern of unsafePatterns) {
            if (pattern.test(tool.implementation)) {
                issues.push(`Implementation contains unsafe pattern: ${pattern.source}`);
            }
        }

        return {
            valid: issues.length === 0,
            issues,
        };
    }

    private async registerTool(tool: ToolDefinition): Promise<void> {
        try {
            const registry = getToolRegistry();

            await registry.register({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
                handler: async (params: Record<string, unknown>) => {
                    // Create sandboxed execution context
                    const fn = new Function(
                        'params',
                        'console',
                        'JSON',
                        'Math',
                        'Date',
                        `return (async () => { ${tool.implementation} })()`
                    );

                    return fn(
                        params,
                        console,
                        JSON,
                        Math,
                        Date
                    );
                },
            });
        } catch (error) {
            console.error('[ToolsmithAgent] Failed to register tool:', error);
        }
    }
}
