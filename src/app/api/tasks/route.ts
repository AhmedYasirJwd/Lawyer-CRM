import { NextRequest, NextResponse } from "next/server";
import { getTasks, createTask } from "@/lib/db";

export async function GET() {
  const tasks = await getTasks();
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const created = await createTask({
    title: body.title,
    caseId: body.caseId,
    dueDate: body.dueDate,
  });

  return NextResponse.json(created, { status: 201 });
}
