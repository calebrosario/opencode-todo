import { Plugin } from "@opencode/plugin/tui"
import { usePlugin } from "@opencode/plugin/tui"
import { createSignal, For, onCleanup, Show } from "solid-js"
import type { PanelInput } from "@opencode/plugin/tui/context"
import { Todo, type TodoItem } from "./rpc.js"

const PANEL_NAME = "opencode-todo"

function TodoPanel(props: { panel: PanelInput }) {
  const context = usePlugin()
  const client = context.client.rpc(Todo)

  const [todos, setTodos] = createSignal<TodoItem[]>([])
  const [selected, setSelected] = createSignal(0)
  const [error, setError] = createSignal<string | null>(null)

  const refresh = async () => {
    try {
      const result = await client.list({})
      setTodos(result.todos)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  void refresh()
  const unsubscribe = client.events.on("updated", () => void refresh())

  const visible = () => todos()
  const clamp = (index: number) => Math.min(Math.max(index, 0), Math.max(visible().length - 1, 0))
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
    const item = visible()[selected()]
    if (item) void mutate(() => client.toggle({ id: item.id }))
  }

  const removeSelected = () => {
    const item = visible()[selected()]
    if (item) void mutate(() => client.remove({ id: item.id }))
  }

  const addTodo = async () => {
    const content = await context.ui.dialog.prompt({ title: "Add todo", placeholder: "Task description" })
    if (content && content.trim()) void mutate(() => client.add({ content: content.trim() }))
  }

  context.keymap.layer(() => ({
    target: () => props.panel,
    commands: [
      { id: "opencode-todo.up", title: "Previous todo", bind: "up,k", run: () => move(-1) },
      { id: "opencode-todo.down", title: "Next todo", bind: "down,j", run: () => move(1) },
      { id: "opencode-todo.first", title: "First todo", bind: "g", run: () => setSelected(0) },
      { id: "opencode-todo.last", title: "Last todo", bind: "shift+g", run: () => setSelected(visible().length - 1) },
      { id: "opencode-todo.toggle", title: "Toggle complete", bind: "space", run: toggleSelected },
      { id: "opencode-todo.add", title: "Add todo", bind: "a", run: () => void addTodo() },
      { id: "opencode-todo.remove", title: "Remove todo", bind: "d", run: removeSelected },
      { id: "opencode-todo.refresh", title: "Refresh", bind: "r", run: () => void refresh() },
      { id: "opencode-todo.fullscreen", title: "Toggle fullscreen", bind: "f", run: props.panel.toggleFullscreen },
    ],
  }))

  // Solid disposes this component when the panel closes.
  onCleanup(() => unsubscribe())

  const statusMark = (status: TodoItem["status"]) =>
    status === "completed" ? "x" : status === "in_progress" ? ">" : " "

  const statusColor = (status: TodoItem["status"]) =>
    status === "completed" ? "#6f9f6f" : status === "in_progress" ? "#e0af68" : context.theme.text.base

  return (
    <box style={{ flexDirection: "column", padding: 0 }}>
      <Show when={error()}>
        {(err) => <text fg="#f7768e">{err()}</text>}
      </Show>
      <Show
        when={visible().length > 0}
        fallback={<text fg={context.theme.text.muted ?? "#888888"}>(no todos — the agent adds them via the todo tool, or press a)</text>}
      >
        <For each={visible()}>
          {(item, index) => (
            <text fg={statusColor(item.status)}>
              {(index() === selected() ? "❯ " : "  ") +
                `[${statusMark(item.status)}] ${item.id}. ${item.content}` +
                (item.status === "completed" ? " (done)" : "")}
            </text>
          )}
        </For>
      </Show>
      <box style={{ height: 1 }} />
      <text fg={context.theme.text.muted ?? "#888888"}>
        {"j/k move · space toggle · a add · d remove · f fullscreen"}
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "opencode-todo.tui",
  setup(context) {
    context.ui.slot({
      append: "session.panel",
      render: (panel) => (
        <Show when={panel.name === PANEL_NAME}>
          <TodoPanel panel={panel} />
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
  },
})
