<template>
	<div
		class="task loader-container draggable"
		:class="{
			'is-loading': loadingInternal || loading,
			'draggable': !(loadingInternal || loading),
			'has-light-text': !colorIsDark(color),
			'has-custom-background-color': color ?? undefined,
			'is-done': task.done,
			'is-expanded': isExpanded,
			'is-phone': isPhone,
		}"
		:style="{'background-color': color ?? undefined}"
		:data-task-id="task.id"
		:data-project-id="task.projectId"
		:data-is-overdue="isOverdue || undefined"
		@click.exact="onCardClick"
		@click.ctrl="() => toggleTaskDone(task)"
		@click.meta="() => toggleTaskDone(task)"
	>
		<img
			v-if="coverImageBlobUrl"
			:src="coverImageBlobUrl"
			alt=""
			width="640"
			height="360"
			loading="lazy"
			decoding="async"
			class="kanban-cover"
		>
		<div class="p-2">
			<div class="tw:flex tw:justify-between">
				<span class="task-id">
					<Done
						v-if="!isPhone"
						class="kanban-card__done"
						:is-done="task.done"
						variant="small"
					/>
					<span
						v-if="showTaskPosition"
						class="tw:text-red-600 tw:ps-2"
					>
						{{ task.position }}
					</span>
				</span>
				<span
					v-if="!isPhone && task.dueDate > 0"
					v-tooltip="formatDateLong(task.dueDate)"
					class="due-date"
				>
					<span class="icon">
						<Icon :icon="['far', 'calendar-alt']" />
					</span>
					<time :datetime="formatISO(task.dueDate)">
						{{ formatDisplayDate(task.dueDate) }}
					</time>
				</span>
				<span
					v-if="isPhone && !isExpanded && tilePipColor"
					class="task-pip"
					:style="{backgroundColor: tilePipColor}"
					aria-hidden="true"
				/>
			</div>
			
			<h3>
				<span
					v-if="isPhone"
					class="kanban-card__check"
					@click.stop
				>
					<FancyCheckbox
						:model-value="task.done"
						tone="complete"
						:disabled="!canWrite || loadingInternal"
						:aria-label="$t('task.detail.markAsDone', {task: task.title})"
						@update:modelValue="toggleTaskDone(task)"
					/>
				</span>
				<RouterLink
					v-if="!isPhone"
					:to="{ name: 'task.detail', params: {id: task.id} }"
					class="kanban-card__title-link"
					draggable="false"
					:title="task.title"
					@click.exact.prevent.stop="openTaskDetail()"
					@click.ctrl.stop
					@click.meta.stop
				>
					{{ displayTaskTitle(task.title) }}
				</RouterLink>
				<button
					v-else
					class="kanban-card__title-link"
					type="button"
					:title="task.title"
					@click.stop="toggle(task.id)"
				>
					{{ displayTaskTitle(task.title) }}
				</button>
			</h3>
			
			<span
				v-if="projectTitle && !isPhone"
				class="project-title"
			>
				{{ projectTitle }}
			</span>

			<ProgressBar
				v-if="task.percentDone > 0 && (!isPhone || isExpanded)"
				class="task-progress"
				:value="task.percentDone * 100"
			/>
			<template v-if="isExpanded">
				<div
					class="kanban-card__expand"
					@click.stop
				>
					<p
						v-if="notesPlain !== ''"
						class="task-notes"
					>
						{{ notesPlain }}
					</p>
					<Labels
						v-if="(task.labels?.length ?? 0) > 0"
						class="task-expanded-labels"
						:labels="task.labels"
					/>
					<BucketSelect
						class="kanban-card__bucket"
						compact
						:task="task"
						:can-write="canWrite"
					/>
					<TaskActionBar
						:task="task"
						:can-write="canWrite"
						@deleted="collapse"
					/>
				</div>
			</template>
			<div
				v-else-if="!isPhone"
				class="footer"
			>
				<div class="footer-start">
					<Labels :labels="task.labels" />
					<PriorityLabel
						:priority="task.priority"
						:done="task.done"
						class="is-inline-flex is-align-items-center"
					/>
				</div>
				<div class="footer-end">
					<span
						v-if="task.attachments.length > 0"
						class="icon"
						role="img"
						:aria-label="$t('task.attributes.attachment', task.attachments.length)"
					>
						<Icon icon="paperclip" />
					</span>
					<span
						v-if="!isEditorContentEmpty(task.description)"
						class="icon"
					>
						<Icon icon="align-left" />
					</span>
					<span
						v-if="task.repeatAfter.amount > 0"
						class="icon"
					>
						<Icon icon="history" />
					</span>
					<CommentCount
						:task="task"
						class="project-task-icon"
					/>
					<AssigneeList
						v-if="task.assignees.length > 0"
						:assignees="task.assignees"
						:avatar-size="24"
					/>
					<ChecklistSummary
						:task="task"
						class="checklist"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import {computed, ref, watch} from 'vue'
import {useRouter} from 'vue-router'

import {useGlobalNow} from '@/composables/useGlobalNow'
import {useIsPhone} from '@/composables/useIsPhone'
import {useExpandedTask} from '@/composables/useExpandedTask'

import PriorityLabel from '@/components/tasks/partials/PriorityLabel.vue'
import ProgressBar from '@/components/misc/ProgressBar.vue'
import Done from '@/components/misc/Done.vue'
import FancyCheckbox from '@/components/input/FancyCheckbox.vue'
import Labels from '@/components/tasks/partials/Labels.vue'
import ChecklistSummary from './ChecklistSummary.vue'
import CommentCount from './CommentCount.vue'
import TaskActionBar from '@/components/tasks/partials/TaskActionBar.vue'
import BucketSelect from '@/components/tasks/partials/BucketSelect.vue'

import {getHexColor} from '@/models/task'
import type {ITask} from '@/modelTypes/ITask'
import type {IProject} from '@/modelTypes/IProject'
import {SUPPORTED_IMAGE_SUFFIX} from '@/models/attachment'
import AttachmentService, {PREVIEW_SIZE} from '@/services/attachment'

import {formatDateLong, formatDisplayDate, formatISO} from '@/helpers/time/formatDate'
import {colorIsDark} from '@/helpers/color/colorIsDark'
import {useTaskStore} from '@/stores/tasks'
import {taskDetailLocation} from '@/helpers/taskDetailBackdrop'
import AssigneeList from '@/components/tasks/partials/AssigneeList.vue'
import {playPopSound} from '@/helpers/playPop'
import {isEditorContentEmpty, plainTextFromEditor} from '@/helpers/editorContentEmpty'
import {useProjectStore} from '@/stores/projects'
import {TASK_REPEAT_MODES} from '@/types/IRepeatMode'
import {displayTaskTitle} from '@/helpers/displayTaskTitle'
import {PERMISSIONS} from '@/constants/permissions'
import {useBaseStore} from '@/stores/base'

const props = withDefaults(defineProps<{
	task: ITask,
	projectId: IProject['id'],
	loading?: boolean,
}>(), {
	loading: false,
})

const emit = defineEmits<{
	'taskCompletedRecurring': [task: ITask]
}>()

const router = useRouter()
const isPhone = useIsPhone()
const {toggle, collapse, expandedTaskId} = useExpandedTask()
const isExpanded = computed(() => isPhone.value && expandedTaskId.value === props.task.id)
const canWrite = computed(() => (useBaseStore().currentProject?.maxPermission ?? 0) > PERMISSIONS.READ)

const loadingInternal = ref(false)
const notesPlain = computed(() => plainTextFromEditor(props.task.description))

const color = computed(() => getHexColor(props.task.hexColor))

const projectStore = useProjectStore()

const projectTitle = computed(() => {
	if (props.projectId === props.task.projectId) {
		return
	}
	
	const project = projectStore.projects[props.task.projectId]
	return project?.title
})

const tilePipColor = computed(() => {
	const labeled = (props.task.labels ?? []).find(label => getHexColor(label.hexColor))
	if (labeled) {
		return getHexColor(labeled.hexColor)
	}
	return getHexColor(projectStore.projects[props.task.projectId]?.hexColor ?? '')
})

const showTaskPosition = computed(() => window.DEBUG_TASK_POSITION)

const {now} = useGlobalNow()
const isOverdue = computed(() => (
	!props.task.done &&
	props.task.dueDate !== null &&
	props.task.dueDate.getTime() > 0 &&
	props.task.dueDate.getTime() <= now.value.getTime()
))

async function toggleTaskDone(task: ITask) {
	const isRecurringTask = task.repeatAfter.amount > 0 || task.repeatMode === TASK_REPEAT_MODES.REPEAT_MODE_MONTH
	const wasBeingMarkedDone = !task.done
	
	loadingInternal.value = true
	try {
		const updatedTask = await useTaskStore().update({
			...task,
			done: !task.done,
		})

		if (updatedTask.done) {
			playPopSound()
		}
		
		// Emit event if this was a recurring task being marked as done
		if (isRecurringTask && wasBeingMarkedDone && updatedTask.done) {
			emit('taskCompletedRecurring', updatedTask)
		}
	} finally {
		loadingInternal.value = false
	}
}

function openTaskDetail() {
	router.push(taskDetailLocation(props.task.id, router.currentRoute.value.fullPath))
}

function onCardClick() {
	if (isPhone.value) {
		toggle(props.task.id)
		return
	}
	openTaskDetail()
}

const coverImageBlobUrl = ref<string | null>(null)

async function maybeDownloadCoverImage() {
	if (!props.task.coverImageAttachmentId) {
		coverImageBlobUrl.value = null
		return
	}

	const attachment = props.task.attachments.find(a => a.id === props.task.coverImageAttachmentId)
	if (!attachment || !SUPPORTED_IMAGE_SUFFIX.some((suffix) => attachment.file.name.toLowerCase().endsWith(suffix))) {
		return
	}

	const attachmentService = new AttachmentService()
	coverImageBlobUrl.value = await attachmentService.getBlobUrl(attachment, PREVIEW_SIZE.LG)
}

watch(
	() => props.task.coverImageAttachmentId,
	maybeDownloadCoverImage,
	{immediate: true},
)
</script>

<style lang="scss" scoped>
$task-background: var(--white);

.task {
	-webkit-touch-callout: none; // iOS Safari
	user-select: none;
	cursor: pointer;
	box-shadow: none;
	border: 1px solid var(--card-border-color);
	display: block;

	font-size: 1rem;
	border-radius: $radius-large;
	background: $task-background;
	overflow: hidden;
	transition: box-shadow $transition, border-color $transition, opacity $transition;

	&:hover {
		box-shadow: var(--shadow-sm);
		border-color: var(--grey-300);
	}

	&.is-phone:hover {
		box-shadow: none;
		border-color: var(--card-border-color);
	}

	&.is-done {
		opacity: 0.72;
	}

	@media (prefers-reduced-motion: reduce) {
		&.is-done {
			opacity: 0.85;
		}
	}

	&.is-done h3 {
		text-decoration: line-through;
		text-decoration-color: var(--success-text);
		text-decoration-thickness: 1.5px;
		color: var(--text-muted);
	}

	&.loader-container.is-loading::after {
		inline-size: 1.5rem;
		block-size: 1.5rem;
		inset-block-start: calc(50% - .75rem);
		inset-inline-start: calc(50% - .75rem);
		border-width: 2px;
	}

	h3 {
		display: flex;
		align-items: flex-start;
		gap: 0.15rem;
		font-family: $family-sans-serif;
		font-size: 1rem;
		font-weight: 500;
		min-inline-size: 0;
		color: var(--primary);
	}

	.kanban-card__title-link {
		display: block;
		flex: 1;
		min-inline-size: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: inherit;
		text-decoration: none;
	}

	.due-date {
		float: inline-end;
		display: flex;
		align-items: center;
		padding: 0 .25rem;
		font-size: 0.82rem;

		.icon {
			margin-inline-end: .25rem;
		}

	}

	&[data-is-overdue] .due-date {
		color: var(--danger-text);
	}

	.label-wrapper .tag {
		margin: .5rem .5rem 0 0;
	}

	.footer {
		background: transparent;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem;
		margin-block-start: 0.5rem;

		:deep(.checklist-summary) {
			padding-inline-start: 0;
		}

		.assignees {
			display: flex;

			.user {
				display: inline;
				margin: 0;

				img {
					margin: 0;
				}
			}
		}

		.priority-label {
			font-size: 0.82rem;
			padding: 0 .5rem 0 .25rem;

			.icon {
				block-size: 1rem;
				padding: 0 .25rem;
				margin-block-start: 0;
			}
		}
	}

	.footer-start,
	.footer-end {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		min-inline-size: 0;
	}

	.footer-end {
		margin-inline-start: auto;
		justify-content: flex-end;
	}

	.footer-start :deep(.label-wrapper .tag) {
		margin: 0;
	}

	.footer .icon,
	.due-date,
	.priority-label {
		background: var(--grey-100);
		border-radius: $radius;
		padding: 0 .5rem;
	}

	.task-id, .project-title {
		color: var(--grey-500);
		font-size: 0.82rem;
		margin-block-end: .25rem;
		display: flex;
	}

	&.is-moving {
		opacity: .5;
	}

	span {
		inline-size: auto;
	}

	&.has-custom-background-color {
		color: #000000; // pure black, not grey-800: guarantees 4.5:1 at the luminance flip point

		h3 {
			color: inherit;
		}

		.footer .icon,
		.due-date,
		.priority-label {
			background: var(--rail-ink);
		}

		// beat component-level color: var(--grey-500) so secondary text tracks the guaranteed main text color
		.task-id, .project-title {
			color: inherit;
		}

		.footer :deep(.checklist-summary) {
			color: inherit;
		}
	}

	&.has-light-text {
		--white: hsla(var(--white-h), var(--white-s), var(--white-l), var(--white-a)) !important;
		color: var(--white);

		.footer .icon,
		.due-date,
		.priority-label {
			background: var(--rail-bg);
		}

		.footer {
			.icon svg {
				fill: var(--white);
			}
		}

		// beat component-level color: var(--grey-500) so secondary text tracks the guaranteed main text color
		.task-id, .project-title {
			color: inherit;
		}

		.footer :deep(.checklist-summary) {
			color: inherit;
		}

		// var(--danger-text)/PriorityLabel's --danger-text fail on the dark grey-800 chip bg; brightened red keeps hue/sat, hits >= 4.5:1
		&[data-is-overdue] .due-date,
		.priority-label.high-priority {
			color: hsl(var(--danger-h), var(--danger-s), 68%);
		}
	}
}

.kanban-cover {
	inline-size: 100%;
	block-size: auto;
	aspect-ratio: 16 / 9;
	object-fit: cover;
	background: var(--grey-200);
}

.kanban-card__done {
	margin-inline-end: .25rem;
}

.kanban-card__check {
	flex-shrink: 0;
	margin-block-start: -0.15rem;
}

.task-progress {
	margin-block-start: 0.5rem;
	inline-size: 100%;
}

:deep(.comment-count) {
	background: var(--grey-100);
	border-radius: $radius;
	padding: 0.25rem;
}

.task.is-phone {
	.kanban-card__title-link {
		white-space: normal;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		text-overflow: unset;
		overflow: hidden;
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: inherit;
		text-align: start;
		cursor: pointer;
		inline-size: 100%;
	}

	.task-pip {
		inline-size: 0.55rem;
		block-size: 0.55rem;
		border-radius: 100%;
		margin-inline-start: auto;
		align-self: center;
	}
}

.task.is-expanded {
	overflow: visible;
	z-index: 3;

	.kanban-card__title-link {
		-webkit-line-clamp: unset;
		line-clamp: unset;
		white-space: normal;
		display: block;
	}
}

.task-notes {
	display: block;
	inline-size: 100%;
	margin: 0.25rem 0 0;
	font-size: 0.82rem;
	line-height: 1.45;
	color: var(--text-muted);
	text-align: start;
	white-space: pre-wrap;
}

.task-expanded-labels,
.kanban-card__bucket {
	margin-block-start: 0.35rem;
}

.kanban-card__bucket {
	display: block;
}

:deep(.task-action-bar) {
	margin-block-start: 0.45rem;
}
</style>
