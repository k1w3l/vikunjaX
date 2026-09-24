<template>
	<Modal
		:enabled="open"
		overflow
		:aria-label="$t('task.createModal.title')"
		@close="close"
	>
		<div class="content">
			<form
				class="create-task-form"
				@submit.prevent="submit"
			>
				<input
					v-model="title"
					v-focus
					class="input create-task-title"
					type="text"
					required
					:placeholder="$t('task.createModal.titlePlaceholder')"
					:aria-label="$t('task.attributes.title')"
					:aria-invalid="titleError ? true : undefined"
					@input="titleError = null"
				>
				<p
					v-if="titleError || projectError"
					class="help is-danger"
				>
					{{ titleError || projectError }}
				</p>
				<TaskActionBar
					:can-write="true"
					:due-date="dueDate"
					:priority="priority"
					:labels="selectedLabels"
					:reminders="reminders"
					:project-id="selectedProjectId"
					:pending-files="pendingFiles"
					:subtask-titles="subtaskTitles"
					:description="description"
					@update:dueDate="dueDate = $event"
					@update:priority="priority = $event"
					@update:labels="selectedLabels = $event"
					@update:reminders="reminders = $event"
					@update:projectId="onProjectPicked"
					@update:pendingFiles="pendingFiles = $event"
					@update:subtaskTitles="subtaskTitles = $event"
					@update:description="description = $event"
					@discard="close"
				/>
			</form>
		</div>
		<div class="actions">
			<XButton
				variant="tertiary"
				@click="close"
			>
				{{ $t('misc.cancel') }}
			</XButton>
			<XButton
				variant="primary"
				:shadow="false"
				:loading="loading"
				@click="submit"
			>
				{{ $t('task.createModal.submit') }}
			</XButton>
		</div>
	</Modal>
</template>

<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {useRouter} from 'vue-router'

import Modal from '@/components/misc/Modal.vue'
import TaskActionBar from '@/components/tasks/partials/TaskActionBar.vue'

import {PRIORITIES} from '@/constants/priorities'
import {taskDetailLocation} from '@/helpers/taskDetailBackdrop'
import {uploadFile} from '@/helpers/attachments'
import {error, success} from '@/message'
import type {ILabel} from '@/modelTypes/ILabel'
import type {ITask} from '@/modelTypes/ITask'
import type {ITaskReminder} from '@/modelTypes/ITaskReminder'
import TaskRelationModel from '@/models/taskRelation'
import TaskRelationService from '@/services/taskRelation'
import {RELATION_KIND} from '@/types/IRelationKind'
import {useAuthStore} from '@/stores/auth'
import {useLabelStore} from '@/stores/labels'
import {useTaskStore} from '@/stores/tasks'
import {useIsPhone} from '@/composables/useIsPhone'
import {useExpandedTask} from '@/composables/useExpandedTask'

const props = withDefaults(defineProps<{
	open: boolean
	projectId?: number | null
	bucketId?: number | null
	defaultTitle?: string
	defaultStartDate?: Date | string | null
	defaultEndDate?: Date | string | null
}>(), {
	projectId: null,
	bucketId: null,
	defaultTitle: '',
	defaultStartDate: null,
	defaultEndDate: null,
})

const emit = defineEmits<{
	close: []
	created: [task: ITask]
}>()

const {t} = useI18n({useScope: 'global'})
const router = useRouter()
const authStore = useAuthStore()
const labelStore = useLabelStore()
const taskStore = useTaskStore()
const isPhone = useIsPhone()
const {expand} = useExpandedTask()
const taskRelationService = new TaskRelationService()

const title = ref('')
const priority = ref(PRIORITIES.UNSET)
const dueDate = ref<Date | null>(null)
const startDate = ref<Date | null>(null)
const endDate = ref<Date | null>(null)
const selectedProjectId = ref(0)
const selectedLabels = ref<ILabel[]>([])
const reminders = ref<ITaskReminder[]>([])
const pendingFiles = ref<File[]>([])
const subtaskTitles = ref<string[]>([])
const description = ref('')

const loading = computed(() => taskStore.isLoading)

function onProjectPicked(id: number) {
	selectedProjectId.value = id
	projectError.value = null
}

const titleError = ref<string | null>(null)
const projectError = ref<string | null>(null)

function validate(): boolean {
	titleError.value = title.value.trim() === '' ? t('task.detail.titleRequired') : null
	projectError.value = selectedProjectId.value > 0 ? null : t('task.createModal.chooseProject')
	return titleError.value === null && projectError.value === null
}

function toDate(value: Date | string | null | undefined): Date | null {
	if (!value) {
		return null
	}
	const date = value instanceof Date ? value : new Date(value)
	return Number.isNaN(date.getTime()) ? null : date
}

function initialProjectId() {
	if (props.projectId && props.projectId > 0) {
		return props.projectId
	}
	const fromRoute = Number(router.currentRoute.value.params.projectId)
	if (fromRoute > 0) {
		return fromRoute
	}
	return authStore.settings.defaultProjectId || 0
}

function reset() {
	title.value = props.defaultTitle
	priority.value = PRIORITIES.UNSET
	dueDate.value = null
	startDate.value = toDate(props.defaultStartDate)
	endDate.value = toDate(props.defaultEndDate)
	selectedProjectId.value = initialProjectId()
	selectedLabels.value = []
	reminders.value = []
	pendingFiles.value = []
	subtaskTitles.value = []
	description.value = ''
	titleError.value = null
	projectError.value = null
}

watch(() => props.open, (open) => {
	if (open) {
		reset()
		labelStore.loadAllLabels()
	}
})

function close() {
	emit('close')
}

async function submit() {
	if (loading.value || !validate()) {
		return
	}

	const projectId = selectedProjectId.value

	try {
		let task = await taskStore.createNewTask({
			title: title.value.trim(),
			projectId,
			bucketId: props.bucketId || undefined,
		})

		const extra = {
			priority: priority.value,
			dueDate: dueDate.value,
			startDate: startDate.value,
			endDate: endDate.value,
			reminders: reminders.value,
			description: description.value,
		}

		const hasExtra = extra.priority !== PRIORITIES.UNSET
			|| extra.dueDate !== null
			|| extra.startDate !== null
			|| extra.endDate !== null
			|| extra.reminders.length > 0
			|| extra.description !== ''

		if (hasExtra) {
			task = await taskStore.update({
				...task,
				...extra,
			})
		}

		for (const label of selectedLabels.value) {
			await taskStore.addLabel({label, taskId: task.id})
		}

		for (const file of pendingFiles.value) {
			await uploadFile(task.id, file)
		}

		for (const subtaskTitle of subtaskTitles.value) {
			const created = await taskStore.createNewTask({
				title: subtaskTitle,
				projectId,
			})
			await taskRelationService.create(new TaskRelationModel({
				taskId: task.id,
				otherTaskId: created.id,
				relationKind: RELATION_KIND.SUBTASK,
			}))
		}

		success({message: t('task.createSuccess'), title: false})
		emit('created', task)
		close()

		if (isPhone.value) {
			expand(task.id)
			return
		}

		await router.push(taskDetailLocation(task.id, router.currentRoute.value.fullPath))
	} catch (e) {
		error(e)
	}
}
</script>

<style scoped lang="scss">
.create-task-form {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	text-align: start;
}

.create-task-title {
	font-size: 1.25rem;
	font-weight: 650;
	min-block-size: 2.75rem;
}

.content {
	padding: 1.5rem 1.5rem 0;
	text-align: start;
}

.actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
	padding: 1rem 1.5rem 1.5rem;
}

:deep(.task-action-bar) {
	margin-block-start: 0.15rem;
}
</style>
