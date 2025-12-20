import { describe, it, expect, beforeEach } from 'vitest';
import { createTask, createProject, createTodoItem } from '../validation/schemas.js';

describe('Task Schema', () => {
    it('should create a valid task', () => {
        const task = createTask('project-1', 'user-1', 'Test query');

        expect(task).toBeDefined();
        expect(task.id).toMatch(/^task-/);
        expect(task.project_id).toBe('project-1');
        expect(task.user_id).toBe('user-1');
        expect(task.query).toBe('Test query');
        expect(task.status).toBe('pending');
        expect(task.todo_list).toEqual([]);
        expect(task.artifacts).toEqual([]);
    });

    it('should set created_at timestamp', () => {
        const before = new Date().toISOString();
        const task = createTask('p1', 'u1', 'query');
        const after = new Date().toISOString();

        expect(task.created_at >= before).toBe(true);
        expect(task.created_at <= after).toBe(true);
    });
});

describe('Project Schema', () => {
    it('should create a valid project', () => {
        const project = createProject('Test Project', 'user-1');

        expect(project).toBeDefined();
        expect(project.id).toMatch(/^proj-/);
        expect(project.name).toBe('Test Project');
        expect(project.user_id).toBe('user-1');
        expect(project.recent_messages).toEqual([]);
        expect(project.session_summaries).toEqual([]);
    });
});

describe('TodoItem Schema', () => {
    it('should create a valid todo item', () => {
        const todo = createTodoItem('Test description', 'researcher', 'test input');

        expect(todo).toBeDefined();
        expect(todo.id).toMatch(/^todo-/);
        expect(todo.description).toBe('Test description');
        expect(todo.agent).toBe('researcher');
        expect(todo.inputs).toBe('test input');
        expect(todo.status).toBe('pending');
        expect(todo.requires_approval).toBe(false);
    });

    it('should set approval requirements', () => {
        const todo = createTodoItem('Deploy', 'coder', 'deploy command', true);

        expect(todo.requires_approval).toBe(true);
    });
});
