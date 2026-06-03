"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import {
  getTasksDueToday,
  createTask,
  updateTaskStatus,
} from "@/lib/services/tasks";
import type { Task } from "@/types";

export function TasksWidget() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!profile?.id) return;
    setTasks(await getTasksDueToday(profile.id));
  };

  useEffect(() => {
    void load();
  }, [profile?.id]);

  const handleAdd = async () => {
    if (!newTitle.trim() || !profile) return;
    const due = new Date();
    due.setHours(18, 0, 0, 0);
    await createTask({
      userId: profile.id,
      userName: profile.name,
      title: newTitle.trim(),
      dueAt: due,
    });
    setNewTitle("");
    setAdding(false);
    toast.success("Task added");
    load();
  };

  const toggleComplete = async (task: Task) => {
    await updateTaskStatus(task.id, task.status === "pending" ? "completed" : "pending");
    load();
  };

  return (
    <Card className="border-border/60 bg-card/90 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/20">
        <CardTitle className="text-base font-semibold">Today&apos;s Tasks</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {adding && (
          <div className="flex gap-2">
            <Input
              placeholder="Task title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button size="sm" onClick={handleAdd}>
              Add
            </Button>
          </div>
        )}
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No tasks due today</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3"
            >
              <button type="button" onClick={() => toggleComplete(task)} className="mt-0.5 shrink-0">
                {task.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    task.status === "completed" && "line-through text-muted-foreground"
                  )}
                >
                  {task.title}
                </p>
                {task.candidateId && (
                  <Link
                    href={`/candidates/${task.candidateId}`}
                    className="text-xs text-primary hover:underline"
                  >
                    {task.candidateName}
                  </Link>
                )}
                <p className="text-xs text-muted-foreground">{format(task.dueAt, "h:mm a")}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
