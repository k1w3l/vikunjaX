<template>
	<div
		class="task-action-bar"
		:class="{'is-draft': isDraft}"
		@click.stop
		@keyup.stop
	>
		<Dropdown
			v-if="!isDraft"
			class="action-slot"
		>
			<template #trigger="{toggleOpen, open}">
				<BaseButton
					class="action-icon"
					:class="{'is-open': open}"
					:disabled="!canWrite"
					:aria-label="$t('task.attributes.title')"
					:aria-expanded="open"
					@click="canWrite ? openTitleEditor(toggleOpen) : undefined"
				>
					<Icon icon="pen" />
				</BaseButton>
			</template>
			<template #default="{close}">
				<form
					class="action-field"
					@submit.prevent="saveTitle(close)"
				>
					<input
						ref="titleInputRef"
						v-model="titleDraft"
						class="input"
						type="text"
						:aria-label="$t('task.attributes.title')"
					>
					<XButton
						variant="primary"
						:shadow="false"
						:disabled="!titleDraft.trim()"
						@click="saveTitle(close)"
					>
						{{ $t('misc.save') }}
					</XButton>
				</form>
			</template>
		</Dropdown>

		<Dropdown class="action-slot">
			<template #trigger="{toggleOpen, open}">
				<BaseButton
					class="action-icon"
					:class="dueIconClass(open)"
					:disabled="!canWrite"
					:aria-label="$t('task.attributes.dueDate')"
					:aria-expanded="open"
					:aria-pressed="hasDue"
					@click="canWrite ? toggleOpen() : undefined"
				>
					<Icon :icon="['far', 'calendar-alt']" />
				</BaseButton>
			</template>
			<template #default="{close}">
				<DropdownItem @click="setDuePreset('today', close)">
					{{ $t('input.datepicker.today') }}
				</DropdownItem>
				<DropdownItem @click="setDuePreset('tomorrow', close)">
					{{ $t('input.datepicker.tomorrow') }}
				</DropdownItem>
				<DropdownItem @click="setDuePreset('nextWeek', close)">
					{{ $t('input.datepicker.nextWeek') }}
				</DropdownItem>
				<div class="action-field">
					<input
						class="input"
						type="date"
						:value="dueInputValue"
						:aria-label="$t('task.attributes.dueDate')"
						@change="setDueFromInput($event, close)"
					>
				</div>
				<DropdownItem
					v-if="hasDue"
					@click="clearDue(close)"
				>
					{{ $t('task.detail.removeDueDate') }}
				</DropdownItem>
			</template>
		</Dropdown>

		<Dropdown class="action-slot">
			<template #trigger="{toggleOpen, open}">
				<BaseButton
					class="action-icon"
					:class="priorityIconClass(open)"
					:disabled="!canWrite"
					:aria-label="$t('task.attributes.priority')"
					:aria-expanded="open"
					:aria-pressed="hasPriority"
					@click="canWrite ? toggleOpen() : undefined"
				>
					<Icon icon="flag" />
				</BaseButton>
			</template>
			<template #default="{close}">
				<DropdownItem
					v-for="option in priorityOptions"
					:key="option.value"
					:class="{'is-checked': currentPriority === option.value}"
					@click="setPriority(option.value, close)"
				>
					<span
						class="priority-dot"
						:class="`is-priority-${option.value}`"
						:aria-hidden="true"
					/>
					<span>{{ option.label }}</span>
					<Icon
						v-if="currentPriority === option.value"
						icon="check"
						class="check-mark"
					/>
				</DropdownItem>
			</template>
		</Dropdown>

		<Dropdown class="action-slot">
			<template #trigger="{toggleOpen, open}">
				<BaseButton
					class="action-icon"
					:class="{'is-open': open, 'is-active': hasLabels}"
					:disabled="!canWrite"
					:aria-label="$t('task.attributes.labels')"
					:aria-expanded="open"
					:aria-pressed="hasLabels"
					@click="canWrite ? toggleOpen() : undefined"
				>
					<Icon icon="tag" />
				</BaseButton>
			</template>
			<template #default>
				<div class="action-field">
					<input
						v-model="labelQuery"
						class="input"
						type="search"
						:placeholder="$t('task.actionBar.searchLabels')"
						:aria-label="$t('task.actionBar.searchLabels')"
					>
				</div>
				<DropdownItem
					v-for="label in filteredLabels"
					:key="label.id"
					:class="{'is-checked': isLabelSelected(label.id)}"
					@click="toggleLabel(label)"
				>
					<span
						class="label-dot"
						:style="{backgroundColor: labelDotColor(label)}"
						:aria-hidden="true"
					/>
					<span>{{ label.title }}</span>
					<Icon
						v-if="isLabelSelected(label.id)"
						icon="check"
						class="check-mark"
					/>
				</DropdownItem>
			</template>
		</Dropdown>

		<Dropdown class="action-slot">
			<template #trigger="{toggleOpen, open}">
				<BaseButton
					class="action-icon"
					:class="{'is-open': open, 'is-active': hasSubtasks}"
					:disabled="!canWrite"
					:aria-label="$t('task.relation.kinds.subtask', 2)"
					:aria-expanded="open"
					:aria-pressed="hasSubtasks"
					@click="canWrite ? toggleOpen() : undefined"
				>
					<Icon icon="list-check" />
				</BaseButton>
			</template>
			<template #default>
				<ul
					v-if="subtaskList.length > 0"
					class="subtask-list"
				>
					<li
						v-for="(item, index) in subtaskList"
						:key="item.id || index"
					>
						{{ item.title }}
					</li>
				</ul>
				<form
					class="action-field"
					@submit.prevent="addSubtask"
				>
					<input
						v-model="newSubtaskTitle"
						class="input"
						type="text"
						:placeholder="$t('task.actionBar.addSubtask')"
						:aria-label="$t('task.actionBar.addSubtask')"
					>
				</form>
			</template>
		</Dropdown>

		<Dropdown class="action-slot">
			<template #trigger="{toggleOpen, open}">
				<BaseButton
					class="action-icon"
					:class="{'is-open': open, 'is-active': hasReminders}"
					:disabled="!canWrite"
					:aria-label="$t('task.attributes.reminders')"
					:aria-expanded="open"
					:aria-pressed="hasReminders"
					@click="canWrite ? toggleOpen() : undefined"
				>
					<Icon icon="bell" />
				</BaseButton>
			</template>
			<template #default="{close}">
				<DropdownItem @click="addReminderPreset('hour', close)">
					{{ $t('task.actionBar.inOneHour') }}
				</DropdownItem>
				<DropdownItem @click="addReminderPreset('tomorrowMorning', close)">
					{{ $t('task.actionBar.tomorrowMorning') }}
				</DropdownItem>
				<DropdownItem @click="addReminderPreset('threeDays', close)">
					{{ $t('task.actionBar.inThreeDays') }}
				</DropdownItem>
				<div class="action-field">
					<input
						v-model="customReminder"
						class="input"
						type="datetime-local"
						:aria-label="$t('task.attributes.reminders')"
					>
					<XButton
						class="add-reminder-btn"
						variant="primary"
						:shadow="false"
						:disabled="!customReminder"
						@click="addCustomReminder(close)"
					>
						{{ $t('task.actionBar.addReminder') }}
					</XButton>
				</div>
				<ul
					v-if="currentReminders.length > 0"
					class="reminder-list"
				>
					<li
						v-for="(reminder, index) in currentReminders"
						:key="index"
					>
						<span>{{ reminderLabel(reminder) }}</span>
						<BaseButton
							:aria-label="$t('task.removeReminder')"
							class="remove-reminder"
							@click="removeReminder(index)"
						>
							<Icon icon="times" />
						</BaseButton>
					</li>
				</ul>
			</template>
		</Dropdown>

		<Dropdown class="action-slot">
			<template #trigger="{toggleOpen, open}">
				<BaseButton
					class="action-icon"
					:class="{'is-open': open, 'is-active': hasAttachments}"
					:disabled="!canWrite"
					:aria-label="$t('task.detail.actions.attachments')"
					:aria-expanded="open"
					:aria-pressed="hasAttachments"
					@click="canWrite ? toggleOpen() : undefined"
				>
					<Icon icon="paperclip" />
				</BaseButton>
			</template>
			<template #default>
				<ul
					v-if="attachmentNames.length > 0"
					class="attachment-list"
				>
					<li
						v-for="(name, index) in attachmentNames"
						:key="index"
					>
						{{ name }}
					</li>
				</ul>
				<p
					v-else
					class="empty-hint"
				>
					{{ $t('task.actionBar.noFiles') }}
				</p>
				<div class="action-field">
					<input
						ref="filesRef"
						class="is-sr-only"
						type="file"
						multiple
						@change="onFilesChosen"
					>
					<XButton
						variant="secondary"
						:shadow="false"
						@click="filesRef?.click()"
					>
						{{ $t('task.actionBar.addFiles') }}
					</XButton>
				</div>
			</template>
		</Dropdown>

		<Dropdown class="action-slot">
			<template #trigger="{toggleOpen, open}">
				<BaseButton
					class="action-icon"
					:class="{'is-open': open, 'is-active': hasProjectColor}"
					:style="folderStyle"
					:disabled="!canWrite"
					:aria-label="$t('task.attributes.project')"
					:aria-expanded="open"
					@click="canWrite ? toggleOpen() : undefined"
				>
					<Icon icon="folder" />
				</BaseButton>
			</template>
			<template #default="{close}">
				<DropdownItem
					v-for="project in selectableProjects"
					:key="project.id"
					:class="{'is-checked': currentProjectId === project.id}"
					@click="setProject(project.id, close)"
				>
					<span
						class="label-dot"
						:style="{backgroundColor: project.color || 'var(--grey-400)'}"
						:aria-hidden="true"
					/>
					<span>{{ project.title }}</span>
					<Icon
						v-if="currentProjectId === project.id"
						icon="check"
						class="check-mark"
					/>
				</DropdownItem>
			</template>
		</Dropdown>

		<Dropdown
			v-if="!isDraft"
			class="action-slot"
		>
			<template #trigger="{toggleOpen, open}">
				<BaseButton
					class="action-icon"
					:class="{'is-open': open}"
					:aria-label="$t('task.actionBar.info')"
					:aria-expanded="open"
					@click="toggleOpen()"
				>
					<Icon icon="circle-info" />
				</BaseButton>
			</template>
			<template #default>
				<dl
					v-if="task"
					class="task-info"
				>
					<div>
						<dt class="is-sr-only">
							{{ $t('task.actionBar.identifier') }}
						</dt>
						<dd>{{ identifier }}</dd>
					</div>
					<div>
						<dt>{{ $t('task.attributes.created') }}</dt>
						<dd>{{ formatDateLong(task.created) }}</dd>
					</div>
					<div>
						<dt>{{ $t('task.attributes.updated') }}</dt>
						<dd>{{ formatDateLong(task.updated) }}</dd>
					</div>
					<div>
						<dt>{{ $t('task.attributes.createdBy') }}</dt>
						<dd>{{ createdByName }}</dd>
					</div>
				</dl>
			</template>
		</Dropdown>

		<BaseButton
			v-if="isDraft"
			class="action-icon is-delete"
			:aria-label="$t('misc.cancel')"
			@click="emit('discard')"
		>
			<Icon icon="trash-alt" />
		</BaseButton>
		<template v-else>
			<BaseButton
				class="action-icon is-delete"
				:disabled="!canWrite"
				:aria-label="$t('task.detail.actions.delete')"
				@click="canWrite ? showDeleteModal = true : undefined"
			>
				<Icon icon="trash-alt" />
			</BaseButton>
			<Modal
				:enabled="showDeleteModal"
				:submit-label="$t('task.detail.delete.confirm')"
				@close="showDeleteModal = false"
				@submit="deleteCurrentTask()"
			>
				<template #header>
					<span>{{ $t('task.detail.delete.header') }}</span>
				</template>
				<template #text>
					<p>{{ $t('task.detail.delete.text1') }}</p>
					<p>{{ $t('task.detail.delete.text2') }}</p>
				</template>
			</Modal>
		</template>
	</div>
</template>

<script setup lang="ts">
import {computed, nextTick, ref, shallowReactive, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import dayjs from 'dayjs'

import BaseButton from '@/components/base/BaseButton.vue'
import Dropdown from '@/components/misc/Dropdown.vue'
import DropdownItem from '@/components/misc/DropdownItem.vue'
import Modal from '@/components/misc/Modal.vue'
import {PRIORITIES} from '@/constants/priorities'
import {MILLISECONDS_A_HOUR} from '@/constants/date'
import {calculateDayInterval} from '@/helpers/time/calculateDayInterval'
import {calculateNearestHours} from '@/helpers/time/calculateNearestHours'
import {formatDateLong, formatDisplayDate} from '@/helpers/time/formatDate'
import {getProjectTitle} from '@/helpers/getProjectTitle'
import {uploadFile} from '@/helpers/attachments'
import {error, success} from '@/message'
import {getHexColor, getTaskIdentifier} from '@/models/task'
import {getDisplayName} from '@/models/user'
import TaskReminderModel from '@/models/taskReminder'
import TaskRelationModel from '@/models/taskRelation'
import TaskRelationService from '@/services/taskRelation'
import {RELATION_KIND} from '@/types/IRelationKind'
import type {ILabel} from '@/modelTypes/ILabel'
import type {ITask} from '@/modelTypes/ITask'
import type {ITaskReminder} from '@/modelTypes/ITaskReminder'
import {useLabelStore} from '@/stores/labels'
import {useProjectStore} from '@/stores/projects'
import {useTaskStore} from '@/stores/tasks'

const props = withDefaults(defineProps<{
	task?: ITask | null
	canWrite?: boolean
	dueDate?: Date | null
	priority?: number
	labels?: ILabel[]
	reminders?: ITaskReminder[]
	projectId?: number
	pendingFiles?: File[]
	subtaskTitles?: string[]
}>(), {
	task: null,
	canWrite: true,
	dueDate: null,
	priority: PRIORITIES.UNSET,
	labels: () => [],
	reminders: () => [],
	projectId: 0,
	pendingFiles: () => [],
	subtaskTitles: () => [],
})

const emit = defineEmits<{
	'update:task': [task: ITask]
	'update:dueDate': [value: Date | null]
	'update:priority': [value: number]
	'update:labels': [value: ILabel[]]
	'update:reminders': [value: ITaskReminder[]]
	'update:projectId': [value: number]
	'update:pendingFiles': [value: File[]]
	'update:subtaskTitles': [value: string[]]
	deleted: []
	discard: []
}>()

const {t} = useI18n({useScope: 'global'})
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const labelStore = useLabelStore()
const taskRelationService = shallowReactive(new TaskRelationService())

const isDraft = computed(() => !props.task?.id)
const showDeleteModal = ref(false)
const labelQuery = ref('')
const newSubtaskTitle = ref('')
const customReminder = ref('')
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)
const filesRef = ref<HTMLInputElement | null>(null)

watch(() => props.task?.id, () => {
	labelQuery.value = ''
	newSubtaskTitle.value = ''
	customReminder.value = ''
	titleDraft.value = props.task?.title ?? ''
})

watch(() => props.task?.title, (title) => {
	titleDraft.value = title ?? ''
}, {immediate: true})

function hasDate(value: Date | string | number | null | undefined): boolean {
	if (value === null || typeof value === 'undefined') {
		return false
	}
	const time = new Date(value).getTime()
	return !Number.isNaN(time) && time > 0
}

const currentDue = computed(() => isDraft.value ? props.dueDate : props.task?.dueDate ?? null)
const hasDue = computed(() => hasDate(currentDue.value))
const currentPriority = computed(() => isDraft.value ? props.priority : props.task?.priority ?? PRIORITIES.UNSET)
const hasPriority = computed(() => currentPriority.value > PRIORITIES.UNSET)
const currentLabels = computed(() => isDraft.value ? props.labels : props.task?.labels ?? [])
const hasLabels = computed(() => currentLabels.value.length > 0)
const currentReminders = computed(() => isDraft.value ? props.reminders : props.task?.reminders ?? [])
const hasReminders = computed(() => currentReminders.value.length > 0)
const currentProjectId = computed(() => isDraft.value ? props.projectId : props.task?.projectId ?? 0)
const currentProject = computed(() => projectStore.projects[currentProjectId.value])
const hasProjectColor = computed(() => Boolean(getHexColor(currentProject.value?.hexColor ?? '')))
const folderStyle = computed(() => {
	const color = getHexColor(currentProject.value?.hexColor ?? '')
	return color ? {'--action-color': color} : undefined
})

const subtaskList = computed(() => {
	if (isDraft.value) {
		return props.subtaskTitles.map((title, index) => ({id: index, title}))
	}
	return props.task?.relatedTasks?.subtask ?? []
})
const hasSubtasks = computed(() => subtaskList.value.length > 0)

const attachmentNames = computed(() => {
	if (isDraft.value) {
		return props.pendingFiles.map(file => file.name)
	}
	return (props.task?.attachments ?? []).map(attachment => attachment.file?.name).filter(Boolean)
})
const hasAttachments = computed(() => attachmentNames.value.length > 0)

const identifier = computed(() => getTaskIdentifier(props.task))
const createdByName = computed(() => props.task?.createdBy ? getDisplayName(props.task.createdBy) : '')

const dueInputValue = computed(() => {
	if (!hasDue.value || !currentDue.value) {
		return ''
	}
	return dayjs(currentDue.value).format('YYYY-MM-DD')
})

const priorityOptions = computed(() => [
	{value: PRIORITIES.UNSET, label: t('task.priority.unset')},
	{value: PRIORITIES.LOW, label: t('task.priority.low')},
	{value: PRIORITIES.MEDIUM, label: t('task.priority.medium')},
	{value: PRIORITIES.HIGH, label: t('task.priority.high')},
	{value: PRIORITIES.URGENT, label: t('task.priority.urgent')},
	{value: PRIORITIES.DO_NOW, label: t('task.priority.doNow')},
])

const filteredLabels = computed(() => {
	const query = labelQuery.value.trim().toLowerCase()
	const all = labelStore.labelsArray
	if (query === '') {
		return all
	}
	return all.filter(label => label.title.toLowerCase().includes(query))
})

const selectableProjects = computed(() => {
	const result: {id: number, title: string, color: string}[] = []

	function walk(parentId: number, depth: number) {
		const children = parentId === 0
			? [...projectStore.notArchivedRootProjects]
			: projectStore.getChildProjects(parentId).filter(p => !p.isArchived && p.id > 0)

		for (const project of children) {
			if (project.id <= 0) {
				continue
			}
			const prefix = depth > 0 ? `${'\u2014 '.repeat(depth)}` : ''
			result.push({
				id: project.id,
				title: `${prefix}${getProjectTitle(project)}`,
				color: getHexColor(project.hexColor) ?? '',
			})
			walk(project.id, depth + 1)
		}
	}

	walk(0, 0)
	return result
})

function dueIconClass(open: boolean) {
	return {
		'is-open': open,
		'is-active': hasDue.value,
		'is-overdue': hasDue.value && !isDraft.value && !props.task?.done && new Date(currentDue.value as Date).getTime() <= Date.now(),
	}
}

function priorityIconClass(open: boolean) {
	return {
		'is-open': open,
		'is-active': hasPriority.value,
		[`is-priority-${currentPriority.value}`]: hasPriority.value,
	}
}

function labelDotColor(label: ILabel) {
	return getHexColor(label.hexColor) ?? 'var(--grey-400)'
}

function isLabelSelected(id: number) {
	return currentLabels.value.some(label => label.id === id)
}

async function openTitleEditor(toggleOpen: () => void) {
	titleDraft.value = props.task?.title ?? ''
	toggleOpen()
	await nextTick()
	titleInputRef.value?.focus()
	titleInputRef.value?.select()
}

async function saveTitle(close: () => void) {
	const title = titleDraft.value.trim()
	if (!title) {
		titleDraft.value = props.task?.title ?? ''
		error({message: t('task.detail.titleRequired')})
		return
	}
	if (title === props.task?.title) {
		close()
		return
	}
	await persist({title})
	close()
}

async function persist(patch: Partial<ITask>) {
	if (!props.task?.id) {
		return
	}
	try {
		const updated = await taskStore.update({
			...props.task,
			...patch,
		})
		emit('update:task', updated)
	} catch (e) {
		error(e)
	}
}

function dateFromPreset(preset: string) {
	const next = new Date()
	next.setDate(next.getDate() + calculateDayInterval(preset))
	next.setHours(calculateNearestHours(next), 0, 0, 0)
	return next
}

async function setDuePreset(preset: string, close: () => void) {
	const dueDate = dateFromPreset(preset)
	if (isDraft.value) {
		emit('update:dueDate', dueDate)
	} else {
		await persist({dueDate})
	}
	close()
}

async function setDueFromInput(event: Event, close: () => void) {
	const value = (event.target as HTMLInputElement).value
	if (!value) {
		await clearDue(close)
		return
	}
	const dueDate = dayjs(value).hour(calculateNearestHours()).minute(0).second(0).toDate()
	if (isDraft.value) {
		emit('update:dueDate', dueDate)
	} else {
		await persist({dueDate})
	}
	close()
}

async function clearDue(close: () => void) {
	if (isDraft.value) {
		emit('update:dueDate', null)
	} else {
		await persist({dueDate: null})
	}
	close()
}

async function setPriority(priority: number, close: () => void) {
	if (isDraft.value) {
		emit('update:priority', priority)
	} else {
		await persist({priority})
	}
	close()
}

async function toggleLabel(label: ILabel) {
	if (isDraft.value) {
		const exists = isLabelSelected(label.id)
		emit('update:labels', exists
			? currentLabels.value.filter(item => item.id !== label.id)
			: [...currentLabels.value, label],
		)
		return
	}
	if (!props.task?.id) {
		return
	}
	try {
		if (isLabelSelected(label.id)) {
			await taskStore.removeLabel({label, taskId: props.task.id})
			emit('update:task', {
				...props.task,
				labels: currentLabels.value.filter(item => item.id !== label.id),
			})
		} else {
			await taskStore.addLabel({label, taskId: props.task.id})
			emit('update:task', {
				...props.task,
				labels: [...currentLabels.value, label],
			})
		}
	} catch (e) {
		error(e)
	}
}

async function addSubtask() {
	const title = newSubtaskTitle.value.trim()
	if (!title) {
		return
	}
	if (isDraft.value) {
		emit('update:subtaskTitles', [...props.subtaskTitles, title])
		newSubtaskTitle.value = ''
		return
	}
	if (!props.task?.id) {
		return
	}
	try {
		const created = await taskStore.createNewTask({
			title,
			projectId: props.task.projectId,
		})
		await taskRelationService.create(new TaskRelationModel({
			taskId: props.task.id,
			otherTaskId: created.id,
			relationKind: RELATION_KIND.SUBTASK,
		}))
		newSubtaskTitle.value = ''
		emit('update:task', {
			...props.task,
			relatedTasks: {
				...props.task.relatedTasks,
				subtask: [...(props.task.relatedTasks?.subtask ?? []), created],
			},
		})
	} catch (e) {
		error(e)
	}
}

function reminderFromPreset(kind: 'hour' | 'tomorrowMorning' | 'threeDays') {
	if (kind === 'hour') {
		return new Date(Date.now() + MILLISECONDS_A_HOUR)
	}
	if (kind === 'tomorrowMorning') {
		return dayjs().add(1, 'day').hour(9).minute(0).second(0).millisecond(0).toDate()
	}
	return dayjs().add(3, 'day').hour(calculateNearestHours()).minute(0).second(0).millisecond(0).toDate()
}

async function addReminderPreset(kind: 'hour' | 'tomorrowMorning' | 'threeDays', close: () => void) {
	await pushReminder(new TaskReminderModel({reminder: reminderFromPreset(kind)}))
	close()
}

async function addCustomReminder(close: () => void) {
	if (!customReminder.value) {
		return
	}
	await pushReminder(new TaskReminderModel({reminder: dayjs(customReminder.value).toDate()}))
	customReminder.value = ''
	close()
}

async function pushReminder(reminder: ITaskReminder) {
	const next = [...currentReminders.value, reminder]
	if (isDraft.value) {
		emit('update:reminders', next)
		return
	}
	await persist({reminders: next})
}

async function removeReminder(index: number) {
	const next = currentReminders.value.filter((_, i) => i !== index)
	if (isDraft.value) {
		emit('update:reminders', next)
		return
	}
	await persist({reminders: next})
}

function reminderLabel(reminder: ITaskReminder) {
	return reminder.reminder ? formatDisplayDate(reminder.reminder) : t('task.addReminder')
}

async function onFilesChosen(event: Event) {
	const input = event.target as HTMLInputElement
	const files = input.files ? Array.from(input.files) : []
	input.value = ''
	if (files.length === 0) {
		return
	}
	if (isDraft.value) {
		emit('update:pendingFiles', [...props.pendingFiles, ...files])
		return
	}
	if (!props.task?.id) {
		return
	}
	try {
		const uploaded = []
		for (const file of files) {
			uploaded.push(...await uploadFile(props.task.id, file))
		}
		emit('update:task', {
			...props.task,
			attachments: [...(props.task.attachments ?? []), ...uploaded],
		})
	} catch (e) {
		error(e)
	}
}

async function setProject(projectId: number, close: () => void) {
	if (isDraft.value) {
		emit('update:projectId', projectId)
		close()
		return
	}
	await persist({projectId})
	close()
}

async function deleteCurrentTask() {
	if (!props.task?.id) {
		return
	}
	try {
		await taskStore.delete(props.task)
		showDeleteModal.value = false
		success({message: t('task.detail.deleteSuccess')})
		emit('deleted')
	} catch (e) {
		error(e)
	}
}
</script>

<style lang="scss" scoped>
.task-action-bar {
	display: grid;
	grid-template-columns: repeat(10, minmax(0, 1fr));
	align-items: center;
	inline-size: 100%;

	&.is-draft {
		grid-template-columns: repeat(8, minmax(0, 1fr));
	}
}

.action-slot {
	display: flex;
	justify-content: center;
	min-inline-size: 0;
}

.action-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-block-size: 44px;
	inline-size: 100%;
	color: var(--text-muted);
	border-radius: $radius;
	transition: color $transition, background-color $transition;

	:deep(svg) {
		inline-size: 1.05rem;
		block-size: 1.05rem;
	}

	&.is-open,
	&.is-active {
		color: var(--action-color, var(--primary));
	}

	&.is-overdue {
		color: var(--danger-text);
	}

	&.is-active.is-priority-1 {
		color: var(--info);
	}

	&.is-active.is-priority-2 {
		color: var(--warning-text);
	}

	&.is-active.is-priority-3 {
		color: var(--primary);
	}

	&.is-active.is-priority-4,
	&.is-active.is-priority-5 {
		color: var(--danger-text);
	}

	&.is-delete:hover,
	&.is-delete:focus-visible {
		color: var(--danger-text);
	}

	&:focus-visible {
		box-shadow: 0 0 0 2px hsla(var(--primary-hsl), 0.5);
	}
}

.action-field {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	padding: 0.35rem 0.75rem 0.5rem;

	.input {
		inline-size: 100%;
	}
}

.add-reminder-btn {
	inline-size: 100%;
}

.priority-dot,
.label-dot {
	display: inline-block;
	inline-size: 0.65rem;
	block-size: 0.65rem;
	border-radius: 100%;
	flex-shrink: 0;
	margin-inline-end: 0.45rem;
	background: var(--grey-400);
}

.priority-dot.is-priority-0 {
	background: transparent;
	box-shadow: inset 0 0 0 1px var(--grey-400);
}

.priority-dot.is-priority-1 {
	background: var(--info);
}

.priority-dot.is-priority-2 {
	background: var(--warning);
}

.priority-dot.is-priority-3 {
	background: var(--primary);
}

.priority-dot.is-priority-4,
.priority-dot.is-priority-5 {
	background: var(--danger);
}

.check-mark {
	margin-inline-start: auto;
	color: var(--primary);
}

:deep(.dropdown-item.is-checked) {
	background: transparent;
	color: var(--text);
}

.subtask-list,
.attachment-list,
.reminder-list {
	list-style: none;
	margin: 0;
	padding: 0.25rem 0.75rem;
	font-size: 0.82rem;
}

.reminder-list li {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	padding-block: 0.2rem;
}

.remove-reminder {
	color: var(--danger-text);
}

.empty-hint {
	margin: 0;
	padding: 0.35rem 0.75rem;
	color: var(--text-muted);
	font-size: 0.82rem;
}

.task-info {
	margin: 0;
	padding: 0.5rem 0.85rem;
	font-size: 0.82rem;
	line-height: 1.45;

	div {
		margin-block-end: 0.35rem;
	}

	dt {
		color: var(--text-muted);
	}

	dd {
		margin: 0;
	}
}
</style>
