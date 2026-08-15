// @vitest-environment jsdom

import { createElement, createRef } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal, ModalHeader } from "./modal";

beforeEach(() => {
  vi.stubGlobal(
    "requestAnimationFrame",
    (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  );
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue(
    [{}] as unknown as DOMRectList,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Modal behavior", () => {
  it("closes from Escape and the backdrop when those behaviors are enabled", () => {
    const onClose = vi.fn();
    render(
      createElement(
        Modal,
        { isOpen: true, onClose, "aria-label": "Preferences" },
        createElement("button", null, "Save"),
      ),
    );
    const dialog = screen.getByRole("dialog", { name: "Preferences" });
    const backdrop = dialog.previousElementSibling as HTMLElement;

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("honors the Escape and backdrop close opt-outs", () => {
    const onClose = vi.fn();
    render(
      createElement(
        Modal,
        {
          isOpen: true,
          onClose,
          closeOnEscape: false,
          closeOnBackdrop: false,
          "aria-label": "Blocking progress",
        },
        createElement("span", null, "Working"),
      ),
    );
    const dialog = screen.getByRole("dialog", { name: "Blocking progress" });
    const backdrop = dialog.previousElementSibling as HTMLElement;

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focuses the requested control and restores the opener on unmount", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const initialFocusRef = createRef<HTMLButtonElement>();

    const { unmount } = render(
      createElement(
        Modal,
        {
          isOpen: true,
          onClose: () => undefined,
          initialFocusRef,
          "aria-label": "Rename workspace",
        },
        createElement("button", { ref: initialFocusRef }, "Rename"),
      ),
    );

    expect(document.activeElement).toBe(initialFocusRef.current);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("wraps focus across the first and last controls", () => {
    render(
      createElement(
        Modal,
        {
          isOpen: true,
          onClose: () => undefined,
          "aria-label": "Confirm action",
        },
        createElement("button", null, "Cancel"),
        createElement("button", null, "Confirm"),
      ),
    );
    const dialog = screen.getByRole("dialog", { name: "Confirm action" });
    const first = screen.getByRole("button", { name: "Cancel" });
    const last = screen.getByRole("button", { name: "Confirm" });

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("wires the standard ModalHeader close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      createElement(
        Modal,
        { isOpen: true, onClose },
        createElement(ModalHeader, { onClose }, "Repository details"),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
