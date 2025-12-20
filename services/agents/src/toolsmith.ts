/**
 * Toolsmith Agent
 * Creates deterministic tool wrappers for common operations
 */

import type { AgentType } from '@mother-harness/shared';
import { BaseAgent, type AgentContext, type AgentResult } from './base-agent.js';

/** Tool definition */
export interface ToolDefinition {
    name: string;
    description: string;
    version: string;
    inputs: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean' | 'object' | 'array';
        required: boolean;
        description: string;
    }>;
    outputs: Array<{
        name: string;
        type: string;
        description: string;
    }>;
    examples: Array<{
        input: Record<string, unknown>;
        output: Record<string, unknown>;
    }>;
}

export class ToolsmithAgent extends BaseAgent {
    readonly agentType: AgentType = 'toolsmith';

    protected async run(inputs: string, context: AgentContext): Promise<AgentResult> {
        const startTime = Date.now();

        // Parse the tool creation request
        const request = this.parseRequest(inputs);

        // Generate tool definition
        const definition = await this.generateDefinition(request, context);

        // Generate tool code
        const code = await this.generateCode(definition);

        // Generate tests
        const tests = await this.generateTests(definition);

        return {
            success: true,
            outputs: {
                tool_definition: definition,
                tool_code: code,
                tests,
                documentation: this.generateDocs(definition),
            },
            explanation: `Created tool: ${definition.name}`,
            artifacts: [`tools/${definition.name}.ts`],
            tokens_used: 400,
            duration_ms: Date.now() - startTime,
        };
    }

    private parseRequest(inputs: string): {
        purpose: string;
        inputs?: Record<string, string>;
        expected_outputs?: string[];
    } {
        return {
            purpose: inputs,
        };
    }

    private async generateDefinition(
        request: ReturnType<typeof this.parseRequest>,
        _context: AgentContext
    ): Promise<ToolDefinition> {
        // TODO: Use LLM to generate proper tool definition

        const name = request.purpose
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .substring(0, 30);

        return {
            name,
            description: request.purpose,
            version: '1.0.0',
            inputs: [
                {
                    name: 'input',
                    type: 'string',
                    required: true,
                    description: 'Input for the tool',
                },
            ],
            outputs: [
                {
                    name: 'result',
                    type: 'string',
                    description: 'Result of the tool operation',
                },
            ],
            examples: [
                {
                    input: { input: 'example input' },
                    output: { result: 'example output' },
                },
            ],
        };
    }

    private async generateCode(definition: ToolDefinition): Promise<string> {
        // TODO: Use LLM to generate actual tool implementation

        const inputParams = definition.inputs
            .map(i => `${i.name}: ${i.type}`)
            .join(', ');

        return `/**
 * ${definition.name}
 * ${definition.description}
 * @version ${definition.version}
 */

export interface ${this.toPascalCase(definition.name)}Input {
${definition.inputs.map(i => `  ${i.name}${i.required ? '' : '?'}: ${i.type};`).join('\n')}
}

export interface ${this.toPascalCase(definition.name)}Output {
${definition.outputs.map(o => `  ${o.name}: ${o.type};`).join('\n')}
}

export async function ${this.toCamelCase(definition.name)}(
  input: ${this.toPascalCase(definition.name)}Input
): Promise<${this.toPascalCase(definition.name)}Output> {
  // TODO: Implement the tool logic
  return {
    result: \`Processed: \${input.input}\`,
  };
}
`;
    }

    private async generateTests(definition: ToolDefinition): Promise<string> {
        return `import { describe, test, expect } from 'vitest';
import { ${this.toCamelCase(definition.name)} } from './${definition.name}';

describe('${definition.name}', () => {
${definition.examples.map((ex, i) => `
  test('example ${i + 1}', async () => {
    const result = await ${this.toCamelCase(definition.name)}(${JSON.stringify(ex.input)});
    expect(result).toBeDefined();
  });
`).join('')}
});
`;
    }

    private generateDocs(definition: ToolDefinition): string {
        return `# ${definition.name}

${definition.description}

## Version
${definition.version}

## Inputs
${definition.inputs.map(i => `- \`${i.name}\` (${i.type}${i.required ? ', required' : ''}): ${i.description}`).join('\n')}

## Outputs
${definition.outputs.map(o => `- \`${o.name}\` (${o.type}): ${o.description}`).join('\n')}

## Examples
${definition.examples.map((ex, i) => `
### Example ${i + 1}
Input: \`${JSON.stringify(ex.input)}\`
Output: \`${JSON.stringify(ex.output)}\`
`).join('')}
`;
    }

    private toPascalCase(str: string): string {
        return str
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }

    private toCamelCase(str: string): string {
        const pascal = this.toPascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }
}
