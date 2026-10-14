import { Plugin } from "@opencode/plugin"
import { Todo, type TodoItem } from "./rpc.js"

interface TodoState {
  todos: TodoItem[]
  counter: number
}

const STORAGE_KEY = "todos"

function render(todos: TodoItem[]): string {
  if (todos.length === 0) return "Todo list is empty."
  const lines = todos.map((t) => {
    const mark = t.status === "completed" ? "x" : t.status === "in_progress" ? ">" : " "
    return `[${mark}] ${t.id}. ${t.content}`
  })
  const open = todos.filter((t) => t.status !== "completed").length
  return `${lines.join("\n")}\n\n${open} open / ${todos.length} total`
}

export default Plugin.define({
  id: "opencode-todo",
  async setup(ctx) {
    const injectContext = (ctx.options as { injectContext?: boolean } | undefined)?.injectContext !== false

    const state: TodoState =
      ((await ctx.storage.get(STORAGE_KEY)) as TodoState | undefined) ?? { todos: [], counter: 0 }

    const persist = async () => {
      await ctx.storage.set(STORAGE_KEY, state)
      await registration?.events.emit("updated", {})
    }

    const nextId = (): string => {
      state.counter += 1
      return String(state.counter)
    }

    const add = (content: string): string => {
      const id = nextId()
      state.todos.push({ id, content, status: "pending" })
      return id
    }

    /** Only one task is in_progress at a time; starting one demotes the rest. */
    const start = (id: string): boolean => {
      const item = state.todos.find((t) => t.id === id)
      if (!item) return false
      for (const t of state.todos) if (t.status === "in_progress") t.status = "pending"
      item.status = "in_progress"
      return true
    }

    const toggle = (id: string): boolean => {
      const item = state.todos.find((t) => t.id === id)
      if (!item) return false
      item.status = item.status === "completed" ? "pending" : "completed"
      return true
    }

    const remove = (id: string): boolean => {
      const before = state.todos.length
      state.todos = state.todos.filter((t) => t.id !== id)
      return state.todos.length !== before
    }

    function context_error(message: string): never {
      throw new Error(message)
    }

    const registration = await ctx.rpc.register(Todo, {
      list: async () => ({ todos: state.todos }),
      add: async (input) => {
        const { content } = input as { content: string }
        const id = add(content)
        await persist()
        return { id }
      },
      toggle: async (input) => {
        const { id } = input as { id: string }
        if (!toggle(id)) return context_error(`No todo with id ${id}`)
        await persist()
        return {}
      },
      remove: async (input) => {
        const { id } = input as { id: string }
        if (!remove(id)) return context_error(`No todo with id ${id}`)
        await persist()
        return {}
      },
    })

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "todo",
        description:
          "Manage the session todo list. Track multi-step work: add tasks as you plan them, " +
          "mark the current task with start, and complete tasks as you finish them. " +
          "Use list to review progress. Keep exactly one task in_progress at a time.",
        input: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["add", "start", "complete", "remove", "list"],
              description:
                "add: create a todo (needs content). start: mark in_progress (needs id). " +
                "complete: mark completed (needs id; completing the in_progress task is the normal flow). " +
                "remove: delete a todo (needs id). list: show all todos.",
            },
            id: { type: "string", description: "Todo id (from add/list output), for start/complete/remove" },
            content: { type: "string", description: "Short task description, for add" },
          },
          required: ["action"],
          additionalProperties: false,
        },
        async execute(input) {
          const { action, id, content } = input as { action: string; id?: string; content?: string }
          let message: string

          switch (action) {
            case "add": {
              const text = (content ?? "").trim()
              if (!text) return { content: "Error: add requires non-empty `content`." }
              const newId = add(text)
              message = `Added ${newId}. ${text}`
              break
            }
            case "start": {
              if (!id) return { content: "Error: start requires `id`." }
              if (!start(id)) return { content: `Error: no todo with id ${id}.` }
              message = `Started ${id}.`
              break
            }
            case "complete": {
              if (!id) return { content: "Error: complete requires `id`." }
              if (!toggle(id)) return { content: `Error: no todo with id ${id}.` }
              message = `Completed ${id}.`
              break
            }
            case "remove": {
              if (!id) return { content: "Error: remove requires `id`." }
              if (!remove(id)) return { content: `Error: no todo with id ${id}.` }
              message = `Removed ${id}.`
              break
            }
            case "list":
            default:
              message = ""
              break
          }

          await persist()
          return { content: message ? `${message}\n\n${render(state.todos)}` : render(state.todos) }
        },
      })
    })

    if (injectContext) {
      await ctx.session.hook("context", (event) => {
        const open = state.todos.filter((t) => t.status !== "completed")
        if (open.length === 0) return
        event.system.push({
          type: "text",
          text:
            "Current todo list (managed via the todo tool — keep it current):\n" +
            render(state.todos),
        })
      })
    }
  },
})
