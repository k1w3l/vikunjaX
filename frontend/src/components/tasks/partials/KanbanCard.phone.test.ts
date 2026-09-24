import {describe, expect, it, vi} from 'vitest'
import {mount} from '@vue/test-utils'
import {ref} from 'vue'

vi.mock('vue-i18n', async (importOriginal) => {
	const actual = await importOriginal<typeof import('vue-i18n')>()
	return {
		...actual,
		useI18n: () => ({t: (key: string) => key}),
	}
})

vi.mock('@/composables/useIsPhone', () => ({
	useIsPhone: () => ref(true),
}))

vi.mock('@/composables/useExpandedTask', () => ({
	useExpandedTask: () => ({
		toggle: vi.fn(),
		collapse: vi.fn(),
		expandedTaskId: ref(null),
	}),
}))

vi.mock('@/stores/tasks', () => ({
	useTaskStore: () => ({update: vi.fn()}),
}))

vi.mock('@/stores/projects', () => ({
	useProjectStore: () => ({projects: {}}),
}))

vi.mock('@/stores/base', () => ({
	useBaseStore: () => ({currentProject: {maxPermission: 2}}),
}))

import {createRouter, createWebHistory} from 'vue-router'
import KanbanCard from './KanbanCard.vue'
import TaskModel from '@/models/task'

describe('KanbanCard on a phone', () => {
	it('shows a checkbox to mark the task done', () => {
		const router = createRouter({
			history: createWebHistory(),
			routes: [{path: '/', component: {template: '<div />'}}],
		})
		const wrapper = mount(KanbanCard, {
			props: {
				task: new TaskModel({
					id: 7,
					title: 'Call the plumber',
					projectId: 1,
					done: false,
					labels: [],
					attachments: [],
				}),
				projectId: 1,
			},
			global: {
				plugins: [router],
				mocks: {$t: (key: string) => key},
				stubs: {
					Icon: true,
					TaskActionBar: true,
					BucketSelect: true,
					Labels: true,
					PriorityLabel: true,
					ProgressBar: true,
					CommentCount: true,
					AssigneeList: true,
					ChecklistSummary: true,
				},
			},
		})

		expect(wrapper.find('.kanban-card__check').exists()).toBe(true)
		expect(wrapper.find('.kanban-card__check input').exists()).toBe(true)
		wrapper.unmount()
	})
})
