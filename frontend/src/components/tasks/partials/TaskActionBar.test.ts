import {describe, it, expect, vi, beforeEach} from 'vitest'
import {mount, flushPromises} from '@vue/test-utils'
import {nextTick} from 'vue'

const update = vi.fn(async (task: {title: string}) => task)

vi.mock('vue-i18n', async (importOriginal) => {
	const actual = await importOriginal<typeof import('vue-i18n')>()
	return {
		...actual,
		useI18n: () => ({t: (key: string) => key}),
	}
})

vi.mock('@/message', () => ({
	error: vi.fn(),
	success: vi.fn(),
}))

vi.mock('@/stores/tasks', () => ({
	useTaskStore: () => ({
		update,
		isLoading: false,
	}),
}))

vi.mock('@/stores/projects', () => ({
	useProjectStore: () => ({
		projects: {},
		notArchivedRootProjects: [],
		getChildProjects: () => [],
	}),
}))

vi.mock('@/stores/labels', () => ({
	useLabelStore: () => ({
		labelsArray: [],
	}),
}))

vi.mock('@floating-ui/dom', () => ({
	computePosition: async () => ({x: 0, y: 0, strategy: 'absolute'}),
	autoPlacement: () => ({}),
	flip: () => ({}),
	offset: () => ({}),
	shift: () => ({}),
	size: () => ({}),
}))

import TaskActionBar from './TaskActionBar.vue'
import TaskModel from '@/models/task'
import {error} from '@/message'

const task = new TaskModel({
	id: 42,
	title: 'Call the plumber',
	projectId: 1,
	labels: [],
	attachments: [],
	reminders: [],
})

function mountBar(props: Record<string, unknown> = {}) {
	return mount(TaskActionBar, {
		attachTo: document.body,
		props: {
			task,
			canWrite: true,
			...props,
		},
		global: {
			mocks: {$t: (key: string) => key},
			stubs: {
				Icon: true,
				Modal: true,
				XButton: {template: '<button type="submit"><slot /></button>'},
			},
		},
	})
}

describe('TaskActionBar — title edit', () => {
	beforeEach(() => {
		update.mockClear()
		document.body.innerHTML = ''
	})

	it('shows a title action on a saved task', () => {
		const wrapper = mountBar()
		const button = wrapper.get('[aria-label="task.attributes.title"]')
		expect(button.attributes('disabled')).toBeUndefined()
		wrapper.unmount()
	})

	it('hides the title action on a draft', () => {
		const wrapper = mountBar({task: null})
		expect(wrapper.find('[aria-label="task.attributes.title"]').exists()).toBe(false)
		wrapper.unmount()
	})

	it('saves a renamed title and emits the updated task', async () => {
		const wrapper = mountBar()
		await wrapper.get('[aria-label="task.attributes.title"]').trigger('click')
		await nextTick()

		const input = wrapper.get('input[type="text"][aria-label="task.attributes.title"]')
		await input.setValue('Fix the sink')
		await wrapper.get('form.action-field').trigger('submit')
		await flushPromises()

		expect(update).toHaveBeenCalledWith(expect.objectContaining({
			id: 42,
			title: 'Fix the sink',
		}))
		expect(wrapper.emitted('update:task')?.[0]?.[0]).toEqual(expect.objectContaining({
			title: 'Fix the sink',
		}))
		wrapper.unmount()
	})

	it('saves from the Save button click', async () => {
		const wrapper = mountBar()
		await wrapper.get('[aria-label="task.attributes.title"]').trigger('click')
		await nextTick()

		await wrapper.get('input[type="text"][aria-label="task.attributes.title"]').setValue('Retitle')
		await wrapper.get('form.action-field button').trigger('click')
		await flushPromises()

		expect(update).toHaveBeenCalledWith(expect.objectContaining({
			title: 'Retitle',
		}))
		wrapper.unmount()
	})

	it('rejects a blank title', async () => {
		const wrapper = mountBar()
		await wrapper.get('[aria-label="task.attributes.title"]').trigger('click')
		await nextTick()

		const input = wrapper.get('input[type="text"][aria-label="task.attributes.title"]')
		await input.setValue('   ')
		await wrapper.get('form.action-field').trigger('submit')
		await flushPromises()

		expect(update).not.toHaveBeenCalled()
		expect(error).toHaveBeenCalled()
		wrapper.unmount()
	})
})
