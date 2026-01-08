import type React from "react";

import { useLocation } from "react-router-dom";

const HOME_PATH = "/";

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: HOME_PATH, icon: null },
];

function isSectionItem(item: NavItem): boolean {
  return !!item.section;
}

function addToSection(
  sections: Record<string, NavItem[]>,
  item: NavItem
): void {
  if (!item.section) return;

  if (!sections[item.section]) {
    sections[item.section] = [];
  }

  sections[item.section].push(item);
}

function isHomeMatch(href: string, pathname: string): boolean {
  return href === HOME_PATH && pathname === HOME_PATH;
}

function isPathMatch(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function groupNav(items: NavItem[]): GroupedNav {
  const base: NavItem[] = [];
  const sections: Record<string, NavItem[]> = {};

  for (const item of items) {
    if (isSectionItem(item)) {
      addToSection(sections, item);
    } else {
      base.push(item);
    }
  }

  return { base, sections } as const;
}

export function useIsActive(): (href: string) => boolean {
  const location = useLocation();

  return (href: string) => {
    if (isHomeMatch(href, location.pathname)) {
      return true;
    }
    return isPathMatch(href, location.pathname);
  };
}

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>> | null;
  section?: string;
}
export interface GroupedNav {
  base: NavItem[];
  sections: Record<string, NavItem[]>;
}
