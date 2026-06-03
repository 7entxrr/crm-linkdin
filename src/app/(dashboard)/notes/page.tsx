"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { StickyNote } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { getAllNotes } from "@/lib/services/notes";
import { useAuth } from "@/context/auth-context";
import type { Note } from "@/types";

export default function NotesPage() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (profile) {
      getAllNotes(profile.id).then(setNotes);
    }
  }, [profile]);

  return (
    <div className="space-y-6">
      <PageHeader title="Notes" description="Your candidate notes timeline" />

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          description="Add notes from any candidate profile page"
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium">{note.authorName}</p>
                  <span className="text-xs text-muted-foreground">
                    {format(note.createdAt, "PPp")}
                  </span>
                </div>
                <p className="mt-2 text-sm">{note.body}</p>
                <Link
                  href={`/candidates/${note.candidateId}`}
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  View candidate →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
