import { useCallback } from "react";
import { Body } from "@/components/ui";
import { Lock } from "@/components/ui/icons";
import { useLazyGetGitHubReposQuery } from "@/lib/redux/api";
import {
  ResourceWizardModal,
  type ResourceWizardConfig,
} from "../shared/resource-wizard-modal";

interface GitHubModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

const CONFIG: ResourceWizardConfig = {
  provider: "github",
  appName: "GitHub",
  modalTitle: "Github",
  icon: "connections/github.png",

  credentialDescription:
    "Enter your GitHub Personal Access Token to connect your repositories.",
  credentialFields: [
    {
      id: "github-token",
      label: "Personal Access Token",
      placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
      dataKey: "token",
      emptyError: "Please enter a valid token",
    },
  ],
  credentialInstructions: (
    <>
      <strong>How to create a token:</strong>
      <br />
      1. Go to GitHub Settings → Developer settings →{" "}
      <a
        href="https://github.com/settings/tokens"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-600 dark:text-primary-400 underline"
      >
        Personal access tokens
      </a>
      <br />
      2. Generate new token (classic)
      <br />
      3. Select scopes: <code>repo</code> and <code>read:user</code>
    </>
  ),
  buildCredentials: (values) => ({ token: values.token }),

  loadingMessage: "Loading repositories...",
  selectTitle: "Select the repositories you want to connect.",
  resourceLabel: "repository",
  resourceLabelPlural: "repositories",
  saveButtonLabel: (count) => `Save ${count} Repositories`,
  addButtonLabel: "Add Repository",
  revokeButtonLabel: "Revoke GitHub Access",
  revokeDescription:
    "This will disconnect all repositories and remove all GitHub data. This action cannot be undone.",

  identityForItem: (item) => item.fullName,
  identityForCurrent: (current) => current.fullName,

  renderItemForSelect: (repo) => (
    <div className="flex items-center gap-2">
      <Body>{repo.fullName}</Body>
      {repo.private && (
        <Lock className="w-3 h-3 text-primary-500 dark:text-primary-600" />
      )}
    </div>
  ),
  renderItemForManage: (resource) => (
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <Body>{resource.fullName}</Body>
        {resource.metadata?.private && (
          <Lock className="w-3 h-3 text-primary-500 dark:text-primary-600" />
        )}
      </div>
    </div>
  ),

  autoSyncProviderLabel: "GitHub",
};

export default function GitHubModal(props: GitHubModalProps) {
  const [getRepos] = useLazyGetGitHubReposQuery();
  const fetchAllResources = useCallback(
    async (connectionId: string) => {
      return getRepos(connectionId).unwrap();
    },
    [getRepos],
  );
  return (
    <ResourceWizardModal
      {...props}
      config={CONFIG}
      fetchAllResources={fetchAllResources}
    />
  );
}
