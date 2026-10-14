import { Rpc } from "@opencode/plugin/rpc"

/**
 * Shared contract between the server plugin (todo tool + storage) and the
 * TUI plugin (session panel). Both halves import this module.
 */

export interface TodoItem {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed"
}

const todoItemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    content: { type: "string" },
    status: { type: "string", enum: ["pending", "in_progress", "completed"] },
  },
  required: ["id", "content", "status"],
  additionalProperties: false,
} as const

export const Todo = Rpc.define({
  id: "opencode-todo",
  methods: {
    list: {
      input: { type: "object", properties: {}, additionalProperties: false },
      output: {
        type: "object",
        properties: { todos: { type: "array", items: todoItemSchema } },
        required: ["todos"],
        additionalProperties: false,
      },
    },
    add: {
      input: {
        type: "object",
        properties: { content: { type: "string" } },
        required: ["content"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
    toggle: {
      input: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      output: { type: "object", properties: {}, additionalProperties: false },
    },
    remove: {
      input: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      output: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  events: {
    /** Emitted after every mutation; subscribers should re-fetch via `list`. */
    updated: {
      schema: { type: "object", additionalProperties: false },
    },
  },
})
