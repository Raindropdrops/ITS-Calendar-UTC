import type { Page } from "playwright";
import type { AcademicCalendarEvent, RawAcademicEvent, SourcePage } from "../../models/academic-calendar-event.js";
import { parseTime } from "../../utils/date.js";
import { selectors } from "./selectors.js";
import { parseRawEvent } from "./parsers.js";

type DomCard = {
  text: string;
  subject?: string;
  date?: string;
  timeText?: string;
  descriptionLines: string[];
  isExam: boolean;
  attributes: Record<string, string>;
};

function dateFromRowId(rowId?: string): string | undefined {
  const match = rowId?.match(/row(\d{2})(\d{2})(\d{4})/i);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : undefined;
}

async function extractStudyCards(page: Page, weekLabel: string): Promise<AcademicCalendarEvent[]> {
  const cards = await page.evaluate((cardSelectors): DomCard[] => {
    const seen = new Set<Element>();
    const elements: Element[] = [];
    for (const selector of cardSelectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (!seen.has(element)) {
          seen.add(element);
          elements.push(element);
        }
      }
    }
    return elements.map((element) => {
      const html = element as HTMLElement;
      const attributes: Record<string, string> = {};
      for (const attr of element.attributes) attributes[attr.name] = attr.value;
      const description = element.querySelector(".task-description");
      const descriptionLines: string[] = [];
      let current = "";
      if (description) {
        for (const node of description.childNodes) {
          if (node instanceof HTMLElement && node.classList.contains("eval")) break;
          if (node.nodeName === "BR") {
            if (current.trim()) descriptionLines.push(current.trim());
            current = "";
          } else current += node.textContent ?? "";
        }
        if (current.trim()) descriptionLines.push(current.trim());
      }
      const row = element.closest(".day-of-week");
      return {
        text: html.innerText || html.textContent || "",
        subject: element.querySelector(".title")?.textContent?.trim() || undefined,
        date: row?.id || undefined,
        timeText: element.querySelector(".task-date")?.textContent?.trim() || undefined,
        descriptionLines,
        isExam: element.classList.contains("btnLichThi"),
        attributes,
      };
    });
  }, [...selectors.eventCards]);

  const events: AcademicCalendarEvent[] = [];
  for (const card of cards) {
    const timeRange = card.timeText?.match(/(\d{1,2}[:h.]\d{2})\s*(?:-|–|—)\s*(\d{1,2}[:h.]\d{2})/i);
    const raw: RawAcademicEvent = {
      sourcePage: "study-calendar",
      sourceExtractor: "dom",
      subject: card.subject?.replace(/^Lịch thi:\s*/i, ""),
      classCode: card.descriptionLines[0],
      date: dateFromRowId(card.date),
      startTime: timeRange?.[1] ? parseTime(timeRange[1]) : undefined,
      endTime: timeRange?.[2] ? parseTime(timeRange[2]) : undefined,
      room: card.descriptionLines[1],
      instructor: card.descriptionLines[2],
      rawText: [card.subject, card.timeText, ...card.descriptionLines].filter(Boolean).join("\n"),
      sourceWeek: weekLabel,
      backendFields: { ...card.attributes, PHANLOAI: card.isExam ? "LICHTHI" : "LICHHOC" },
    };
    const parsed = parseRawEvent(raw);
    if (parsed) events.push(parsed);
  }
  return events;
}

async function extractExamTableRows(page: Page, weekLabel: string): Promise<AcademicCalendarEvent[]> {
  const tables = [
    { selector: "#tblLichThiCaNhan tbody tr", personal: true },
    { selector: "#tblLichThiChung tbody tr", personal: false },
  ];
  const events: AcademicCalendarEvent[] = [];
  for (const table of tables) {
    const rows = page.locator(table.selector);
    for (let index = 0; index < (await rows.count()); index += 1) {
      const cells = (await rows.nth(index).locator("td").allInnerTexts()).map((cell) => cell.trim());
      if (cells.length < 7 || cells.every((cell) => !cell)) continue;
      const offset = cells.length >= (table.personal ? 10 : 8) ? 1 : 0;
      const subject = cells[offset + 1];
      const date = cells[offset + (table.personal ? 3 : 2)];
      const time = cells[offset + (table.personal ? 4 : 3)];
      if (!subject || !date) continue;
      const timeRange = time?.match(/(\d{1,2}[:h.]\d{2})\s*(?:-|–|—)\s*(\d{1,2}[:h.]\d{2})/i);
      const raw: RawAcademicEvent = {
        sourcePage: "exam-calendar",
        sourceExtractor: "dom",
        subject,
        classCode: cells[offset],
        date,
        startTime: timeRange?.[1] ? parseTime(timeRange[1]) : undefined,
        endTime: timeRange?.[2] ? parseTime(timeRange[2]) : undefined,
        examFormat: cells[offset + (table.personal ? 5 : 4)],
        room: cells[offset + (table.personal ? 6 : 5)],
        studentNumber: cells[offset + (table.personal ? 7 : 6)],
        note: table.personal && cells[offset + 2] ? `Lần thi: ${cells[offset + 2]}` : undefined,
        rawText: cells.join("\n"),
        sourceWeek: weekLabel,
        backendFields: { eventType: "exam" },
      };
      const parsed = parseRawEvent(raw);
      if (parsed) events.push(parsed);
    }
  }
  return events;
}

export async function extractEventsFromDom(page: Page, sourcePage: SourcePage, weekLabel: string): Promise<AcademicCalendarEvent[]> {
  return sourcePage === "exam-calendar" ? extractExamTableRows(page, weekLabel) : extractStudyCards(page, weekLabel);
}
