import type { Request, Response } from 'express';
import type { DemoData, User } from '../types.js';

export function getUser(data: DemoData, request: Request, response: Response): void {
  // Deliberate demo bug: the assertion hides the missing-user case from TypeScript.
  const user = data.users.find((entry) => entry.id === request.params.id) as User;
  response.json({ id: user.id, name: user.name, email: user.email });
}
