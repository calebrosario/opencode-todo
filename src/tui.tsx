import { Plugin } from "@opencode/plugin/tui"
import { usePlugin } from "@opencode/plugin/tui"
import { createSignal, For, onCleanup, Show } from "solid-js"
import type { PanelInput } from "@opencode/plugin/tui/context"
import { Todo, type TodoItem } from "./rpc.js"

const PANEL_NAME = "opencode-todo"

const GREEN = "#6f9f6f"
const YELLOW = "#e0af68"
const MUTED = "#888888"

interface TodoStore {
  readonly todos: readonly TodoItem[]
  readonly open: number
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text
}

/** Compact, always-on todo list rendered into the session sidebar. */
function TodoSidebar(props: { data: TodoStore }) {
  const context = usePlugin()
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={MUTED}>── todos ──</text>
      <For each={props.data.todos}>
        {(item) => (
          <text
            fg={item.status === "completed" ? GREEN : item.status === "in_progress" ? YELLOW : context.theme.text.base}
          >
            {(item.status === "completed" ? " x " : item.status === "in_progress" ? " > " : " · ") +
              truncate(item.content, 40)}
          </text>
        )}
      </For>
      <Show
        when={props.data.todos.length > 0}
        fallback={<text fg={MUTED}> (none yet)</text>}
      >
        <text fg={MUTED}>{" " + props.data.open + " open · /todo panel"}</text>
      </Show>
    </box>
  )
}

/** Full interactive session panel, opened via /todo or the command palette. */
function TodoPanel(props: { data: TodoStore; panel: PanelInput }) {
  const context = usePlugin()
  const client = context.client.rpc(Todo)
  const [selected, setSelected] = createSignal(0)
  const [error, setError] = createSignal<string | null>(null)

  const todos = () => props.data.todos
  const clamp = (index: number) => Math.min(Math.max(index, 0), Math.max(todos().length - 1, 0))
  const move = (delta: number) => setSelected(clamp(selected() + delta))

  const mutate = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const toggleSelected = () => {
    const item = todos()[selected()]
    if (item) void mutate(() => client.toggle({ id: item.id }))
  }

  const removeSelected = () => {
    const item = todos()[selected()]
    if (item) void mutate(() => client.remove({ id: item.id }))
  }

  const addTodo = async () => {
    const content = await context.ui.dialog.prompt({ title: "Add todo", placeholder: "Task description" })
    if (content && content.trim()) void mutate(() => client.add({ content: content.trim() }))
  }

  onCleanup(() => {
    unsubscribePanel()
  })

  const unsubscribePanel = context.keymap.layer(() => ({
    target: () => props.panel,
    commands: [
      { id: "opencode-todo.up", title: "Previous todo", bind: "up,k", run: () => move(-1) },
      { id: "opencode-todo.down", title: "Next todo", bind: "down,j", run: () => move(1) },
      { id: "opencode-todo.first", title: "First todo", bind: "g", run: () => setSelected(0) },
      { id: "opencode-todo.last", title: "Last todo", bind: "shift+g", run: () => setSelected(todos().length - 1) },
      { id: "opencode-todo.toggle", title: "Toggle complete", bind: "space", run: toggleSelected },
      { id: "opencode-todo.add", title: "Add todo", bind: "a", run: () => void addTodo() },
      { id: "opencode-todo.remove", title: "Remove todo", bind: "d", run: removeSelected },
      { id: "opencode-todo.fullscreen", title: "Toggle fullscreen", bind: "f", run: props.panel.toggleFullscreen },
    ],
  }))

  const statusMark = (status: TodoItem["status"]) =>
    status === "completed" ? "x" : status === "in_progress" ? ">" : " "

  const statusColor = (status: TodoItem["status"]) =>
    status === "completed" ? GREEN : status === "in_progress" ? YELLOW : context.theme.text.base

  return (
    <box style={{ flexDirection: "column" }}>
      <Show when={error()}>
        {(err) => <text fg="#f7768e">{err()}</text>}
      </Show>
      <Show
        when={todos().length > 0}
        fallback={<text fg={MUTED}>(no todos — the agent adds them via the todo tool, or press a)</text>}
      >
        <For each={todos()}>
          {(item, index) => (
            <text fg={statusColor(item.status)}>
              {(index() === selected() ? "❯ " : "  ") +
                `[${statusMark(item.status)}] ${item.id}. ${truncate(item.content, 60)}`}
            </text>
          )}
        </For>
      </Show>
      <box style={{ height: 1 }} />
      <text fg={MUTED}>{"j/k move · space toggle · a add · d remove · f fullscreen"}</text>
    </box>
  )
}

export default Plugin.define({
  id: "opencode-todo.tui",
  setup(context) {
    const client = context.client.rpc(Todo)
    const [todos, setTodos] = createSignal<readonly TodoItem[]>([])

    const refresh = async () => {
      try {
        const result = await client.list({})
        setTodos(result.todos)
      } catch {
        // server plugin not reachable yet — keep last known state
      }
    }

    void refresh()
    const unsubscribe = client.events.on("updated", () => void refresh())

    const data: TodoStore = {
      get todos() {
        return todos()
      },
      get open() {
        return todos().filter((t) => t.status !== "completed").length
      },
    }

    // Always-on todo list in the session sidebar.
    context.ui.slot({
      append: "sidebar.content",
      render: () => <TodoSidebar data={data} />,
    })

    // Full interactive panel via /todo or the command palette.
    context.ui.slot({
      append: "session.panel",
      render: (panel) => (
        <Show when={panel.name === PANEL_NAME}>
          <TodoPanel data={data} panel={panel} />
        </Show>
      ),
    })

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "opencode-todo.open",
          title: "Open todo list",
          group: "Todo",
          palette: true,
          slash: { name: "todo", aliases: ["todos"] },
          run: () => {
            context.ui.panel.open(PANEL_NAME)
          },
        },
      ],
    }))

    return () => unsubscribe()
  },
})
