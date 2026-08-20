import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createNonOwnerContext(): TrpcContext {
  return {
    user: {
      id: 17,
      openId: "non-owner-user",
      email: "member@example.com",
      name: "Member",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("admin access control", () => {
  it("rejects a non-owner before any dataset operation is attempted", async () => {
    const caller = appRouter.createCaller(createNonOwnerContext());
    await expect(caller.admin.imports()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
