import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createConnection,
  createConnectionResource,
  createConnectionState,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

// Mock external API clients
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn(),
}));
vi.mock("@linear/sdk", () => ({
  LinearClient: vi.fn(),
}));

// Mock decryptSecrets
vi.mock("../connectionCredentials/connectionCredentials.utils", () => ({
  decryptSecrets: vi.fn((buf: Buffer) => JSON.parse(buf.toString("utf-8"))),
}));

import { connectionsService } from "./connections.service";
import { connectionsRepo } from "./connections.repo";

describe("connectionsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  // ─────────────────────────────────────────────────────────────
  // getByProvider
  // ─────────────────────────────────────────────────────────────
  describe("getByProvider", () => {
    it("returns error when provider is empty", async () => {
      const result = await connectionsService.getByProvider("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Provider is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionsService.getByProvider("github");
      assertFail(result);
      if (!result.success) expect(result.error).toContain("connection not found");
    });

    it("returns connection when found", async () => {
      createConnection(db, { id: "c1", provider: "github", metadata: '{"org":"test"}' });

      const result = await connectionsService.getByProvider("github");
      assertOk(result);
      if (result.success) {
        expect(result.data.connection.id).toBe("c1");
        expect(result.data.connection.provider).toBe("github");
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getSelectedResources
  // ─────────────────────────────────────────────────────────────
  describe("getSelectedResources", () => {
    it("returns error when provider is empty", async () => {
      const result = await connectionsService.getSelectedResources("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Provider is required");
    });

    it("returns error for unsupported provider", async () => {
      const result = await connectionsService.getSelectedResources("unknown_provider");
      assertFail(result);
      if (!result.success) expect(result.error).toContain("Unsupported provider");
    });

    it("returns error when no connection", async () => {
      const result = await connectionsService.getSelectedResources("github");
      assertFail(result);
      if (!result.success) expect(result.error).toContain("connection not found");
    });

    it("returns selected resources for github", async () => {
      createConnection(db, { id: "c1", provider: "github" });
      createConnectionResource(db, {
        connectionId: "c1",
        externalId: "user/repo",
        kind: "github_repo",
        name: "user/repo",
        selected: true,
      });
      createConnectionResource(db, {
        connectionId: "c1",
        externalId: "user/repo2",
        kind: "github_repo",
        name: "user/repo2",
        selected: false,
      });

      const result = await connectionsService.getSelectedResources("github");
      assertOk(result);
      if (result.success) {
        const data = result.data as any;
        expect(data.repos).toHaveLength(1);
        expect(data.connectionId).toBe("c1");
      }
    });

    it("returns selected resources for linear", async () => {
      createConnection(db, { id: "c2", provider: "linear" });
      createConnectionResource(db, {
        connectionId: "c2",
        externalId: "TEAM",
        kind: "linear_team",
        name: "Team",
        selected: true,
      });

      const result = await connectionsService.getSelectedResources("linear");
      assertOk(result);
      if (result.success) {
        const data = result.data as any;
        expect(data.teams).toHaveLength(1);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // saveResources
  // ─────────────────────────────────────────────────────────────
  describe("saveResources", () => {
    it("returns error when provider/connectionId missing", async () => {
      const result = await connectionsService.saveResources({
        provider: "",
        connectionId: "",
      });
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Provider and connectionId are required");
    });

    it("returns error for unsupported provider", async () => {
      const result = await connectionsService.saveResources({
        provider: "unknown",
        connectionId: "c1",
        resources: [{}],
      });
      assertFail(result);
      if (!result.success) expect(result.error).toContain("Unsupported provider");
    });

    it("returns error when resources empty", async () => {
      const result = await connectionsService.saveResources({
        provider: "github",
        connectionId: "c1",
        resources: [],
      });
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Resources are required");
    });

    it("saves github resources", async () => {
      createConnection(db, { id: "c1", provider: "github" });

      const result = await connectionsService.saveResources({
        provider: "github",
        connectionId: "c1",
        resources: [
          {
            id: 1,
            fullName: "user/repo",
            name: "repo",
            owner: "user",
            private: false,
            description: "A repo",
            language: "TypeScript",
            stars: 10,
            forks: 2,
            defaultBranch: "main",
            htmlUrl: "https://github.com/user/repo",
            updatedAt: "2024-01-01",
          },
        ],
      });

      assertOk(result);
      if (result.success) expect(result.data.count).toBe(1);

      // Verify resource was actually saved
      const resources = await import("./connections.repo").then((m) =>
        m.connectionsRepo.findResourcesByConnectionId("c1")
      );
      expect(resources).toHaveLength(1);
      expect(resources[0].externalId).toBe("user/repo");
    });

    it("updates existing resource on re-save", async () => {
      createConnection(db, { id: "c1", provider: "github" });
      createConnectionResource(db, {
        connectionId: "c1",
        externalId: "user/repo",
        kind: "github_repo",
        name: "user/repo",
        selected: false,
      });

      const result = await connectionsService.saveResources({
        provider: "github",
        connectionId: "c1",
        resources: [
          {
            id: 1,
            fullName: "user/repo",
            name: "repo",
            owner: "user",
            private: false,
            description: null,
            language: null,
            stars: 0,
            forks: 0,
            defaultBranch: "main",
            htmlUrl: "https://github.com/user/repo",
            updatedAt: null,
          },
        ],
      });

      assertOk(result);

      // Should still be 1 resource (upserted, not duplicated)
      const resources = await import("./connections.repo").then((m) =>
        m.connectionsRepo.findResourcesByConnectionId("c1")
      );
      expect(resources).toHaveLength(1);
      expect(resources[0].selected).toBe(true); // upsert sets selected=true
    });
  });

  // ─────────────────────────────────────────────────────────────
  // removeResource
  // ─────────────────────────────────────────────────────────────
  describe("removeResource", () => {
    it("returns error when resourceId is empty", async () => {
      const result = await connectionsService.removeResource("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Resource ID is required");
    });

    it("returns error when resource not found", async () => {
      const result = await connectionsService.removeResource("nonexistent");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Resource not found");
    });

    it("removes existing resource", async () => {
      createConnection(db, { id: "c1" });
      createConnectionResource(db, {
        id: "res1",
        connectionId: "c1",
        externalId: "e1",
        kind: "github_repo",
        name: "test",
      });

      const result = await connectionsService.removeResource("res1");
      assertOk(result);
      if (result.success) expect(result.data.message).toContain("removed successfully");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // deleteResource
  // ─────────────────────────────────────────────────────────────
  describe("deleteResource", () => {
    it("returns error when resourceId is empty", async () => {
      const result = await connectionsService.deleteResource("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Resource ID is required");
    });

    it("deletes a resource", async () => {
      createConnection(db, { id: "c1" });
      createConnectionResource(db, {
        id: "res1",
        connectionId: "c1",
        externalId: "e1",
        kind: "github_repo",
        name: "test",
      });

      const result = await connectionsService.deleteResource("res1");
      assertOk(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // revoke
  // ─────────────────────────────────────────────────────────────
  describe("revoke", () => {
    it("returns error when provider is empty", async () => {
      const result = await connectionsService.revoke("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Provider is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionsService.revoke("github");
      assertFail(result);
      if (!result.success) expect(result.error).toContain("connection not found");
    });

    it("revokes connection and cleans up", async () => {
      createConnection(db, { id: "c1", provider: "github", status: "active", metadata: "{}" });
      createConnectionState(db, { id: "github", isConnected: true, connectionId: "c1" });
      createConnectionResource(db, {
        connectionId: "c1",
        externalId: "e1",
        kind: "github_repo",
        name: "test",
      });

      const result = await connectionsService.revoke("github");
      assertOk(result);

      // Connection should be revoked
      const { connectionsRepo } = await import("./connections.repo");
      const conn = await connectionsRepo.findById("c1");
      expect(conn!.status).toBe("revoked");

      // Resources should be deleted
      const resources = await connectionsRepo.findResourcesByConnectionId("c1");
      expect(resources).toHaveLength(0);

      // Connection state should be disconnected
      const connectionState = await connectionsRepo.findConnectionState("github");
      expect(connectionState!.isConnected).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getGithubRepos - validation paths
  // ─────────────────────────────────────────────────────────────
  describe("getGithubRepos", () => {
    it("returns error when connectionId is empty", async () => {
      const result = await connectionsService.getGithubRepos("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("connectionId is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionsService.getGithubRepos("nonexistent");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Connection not found");
    });

    it("returns error when token not found", async () => {
      createConnection(db, { id: "c1", provider: "github" });
      const result = await connectionsService.getGithubRepos("c1");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Token not found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getLinearTeams - validation paths
  // ─────────────────────────────────────────────────────────────
  describe("getLinearTeams", () => {
    it("returns error when connectionId is empty", async () => {
      const result = await connectionsService.getLinearTeams("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("connectionId is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionsService.getLinearTeams("nonexistent");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Connection not found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getJiraProjects - validation paths
  // ─────────────────────────────────────────────────────────────
  describe("getJiraProjects", () => {
    it("returns error when connectionId is empty", async () => {
      const result = await connectionsService.getJiraProjects("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("connectionId is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionsService.getJiraProjects("nonexistent");
      assertFail(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getAsanaProjects - validation paths
  // ─────────────────────────────────────────────────────────────
  describe("getAsanaProjects", () => {
    it("returns error when connectionId is empty", async () => {
      const result = await connectionsService.getAsanaProjects("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("connectionId is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionsService.getAsanaProjects("nonexistent");
      assertFail(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getGitlabProjects - validation paths
  // ─────────────────────────────────────────────────────────────
  describe("getGitlabProjects", () => {
    it("returns error when connectionId is empty", async () => {
      const result = await connectionsService.getGitlabProjects("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("connectionId is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionsService.getGitlabProjects("nonexistent");
      assertFail(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getTrelloBoards - validation paths
  // ─────────────────────────────────────────────────────────────
  describe("getTrelloBoards", () => {
    it("returns error when connectionId is empty", async () => {
      const result = await connectionsService.getTrelloBoards("");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("connectionId is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionsService.getTrelloBoards("nonexistent");
      assertFail(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // saveResources - additional providers
  // ─────────────────────────────────────────────────────────────
  describe("saveResources - other providers", () => {
    it("saves linear resources", async () => {
      createConnection(db, { id: "c1", provider: "linear" });
      const result = await connectionsService.saveResources({
        provider: "linear",
        connectionId: "c1",
        resources: [{ id: "t1", key: "TEAM", name: "Team A", description: null, icon: null, color: null, private: false, updatedAt: null, url: "https://linear.app/team" }],
      });
      assertOk(result);
      if (result.success) expect(result.data.count).toBe(1);
    });

    it("saves jira resources", async () => {
      createConnection(db, { id: "c1", provider: "jira" });
      const result = await connectionsService.saveResources({
        provider: "jira",
        connectionId: "c1",
        resources: [{ id: "p1", key: "PROJ", name: "Project", projectTypeKey: "software", avatarUrl: null, description: null, isPrivate: false, url: "https://jira.com/PROJ" }],
      });
      assertOk(result);
    });

    it("saves trello resources", async () => {
      createConnection(db, { id: "c1", provider: "trello" });
      const result = await connectionsService.saveResources({
        provider: "trello",
        connectionId: "c1",
        resources: [{ id: "b1", name: "Board", shortLink: "abc", shortUrl: "https://trello.com/b/abc", desc: "", closed: false, organizationName: null }],
      });
      assertOk(result);
    });

    it("saves gitlab resources", async () => {
      createConnection(db, { id: "c1", provider: "gitlab" });
      const result = await connectionsService.saveResources({
        provider: "gitlab",
        connectionId: "c1",
        resources: [{ id: 1, name: "project", pathWithNamespace: "user/project", webUrl: "https://gitlab.com/user/project", description: null, visibility: "public", lastActivityAt: null, stars: 0, forks: 0, defaultBranch: "main", private: false }],
      });
      assertOk(result);
    });

    it("saves asana resources", async () => {
      createConnection(db, { id: "c1", provider: "asana" });
      const result = await connectionsService.saveResources({
        provider: "asana",
        connectionId: "c1",
        resources: [{ gid: "123", name: "Project", archived: false, color: null, workspaceGid: "w1", workspaceName: "ws", teamGid: null, teamName: null, modifiedAt: null, public: true, url: "https://app.asana.com/0/123" }],
      });
      assertOk(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getSelectedResources - other providers
  // ─────────────────────────────────────────────────────────────
  describe("getSelectedResources - other providers", () => {
    it("returns selected jira resources", async () => {
      createConnection(db, { id: "c1", provider: "jira" });
      createConnectionResource(db, { connectionId: "c1", externalId: "PROJ", kind: "jira_project", name: "Project", selected: true });
      const result = await connectionsService.getSelectedResources("jira");
      assertOk(result);
      if (result.success) {
        const data = result.data as any;
        expect(data.projects).toHaveLength(1);
      }
    });

    it("returns selected asana resources", async () => {
      createConnection(db, { id: "c1", provider: "asana" });
      createConnectionResource(db, { connectionId: "c1", externalId: "123", kind: "asana_project", name: "Proj", selected: true });
      const result = await connectionsService.getSelectedResources("asana");
      assertOk(result);
      if (result.success) {
        const data = result.data as any;
        expect(data.projects).toHaveLength(1);
      }
    });

    it("returns selected gitlab resources", async () => {
      createConnection(db, { id: "c1", provider: "gitlab" });
      createConnectionResource(db, { connectionId: "c1", externalId: "1", kind: "gitlab_project", name: "proj", selected: true });
      const result = await connectionsService.getSelectedResources("gitlab");
      assertOk(result);
      if (result.success) {
        const data = result.data as any;
        expect(data.projects).toHaveLength(1);
      }
    });

    it("returns selected trello resources", async () => {
      createConnection(db, { id: "c1", provider: "trello" });
      createConnectionResource(db, { connectionId: "c1", externalId: "b1", kind: "trello_board", name: "Board", selected: true });
      const result = await connectionsService.getSelectedResources("trello");
      assertOk(result);
      if (result.success) {
        const data = result.data as any;
        expect(data.boards).toHaveLength(1);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error paths
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getByProvider returns error on failure", async () => {
      vi.spyOn(connectionsRepo, "findByProvider").mockRejectedValueOnce(new Error("db"));
      const result = await connectionsService.getByProvider("github");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Failed to fetch connection");
    });

    it("getSelectedResources returns error on failure", async () => {
      vi.spyOn(connectionsRepo, "findByProvider").mockRejectedValueOnce(new Error("db"));
      const result = await connectionsService.getSelectedResources("github");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Failed to fetch selected resources");
    });

    it("saveResources returns error on failure", async () => {
      createConnection(db, { id: "c1", provider: "github" });
      vi.spyOn(connectionsRepo, "findResourceByExternalId").mockRejectedValueOnce(new Error("db"));
      const result = await connectionsService.saveResources({
        provider: "github",
        connectionId: "c1",
        resources: [{ id: 1, fullName: "u/r", name: "r", owner: "u", private: false, description: null, language: null, stars: 0, forks: 0, defaultBranch: "main", htmlUrl: "", updatedAt: null }],
      });
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Failed to save resources");
    });

    it("removeResource returns error on failure", async () => {
      vi.spyOn(connectionsRepo, "deleteResource").mockRejectedValueOnce(new Error("db"));
      const result = await connectionsService.removeResource("res1");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Failed to remove resource");
    });

    it("deleteResource returns error on failure", async () => {
      vi.spyOn(connectionsRepo, "deleteResource").mockRejectedValueOnce(new Error("db"));
      const result = await connectionsService.deleteResource("res1");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Failed to delete resource");
    });

    it("revoke returns error on failure", async () => {
      vi.spyOn(connectionsRepo, "findByProvider").mockRejectedValueOnce(new Error("db"));
      const result = await connectionsService.revoke("github");
      assertFail(result);
      if (!result.success) expect(result.error).toBe("Failed to revoke connection");
    });
  });
});
