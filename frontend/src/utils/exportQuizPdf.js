import { jsPDF } from "jspdf";

function placeText(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(String(text || ""), maxWidth);
  let cy = y;
  for (const line of lines) {
    if (cy > 275) {
      doc.addPage();
      cy = 20;
    }
    doc.text(line, x, cy);
    cy += lineHeight;
  }
  return cy;
}

function renderItems(doc, items, margin, maxW, startY, bodySize, label) {
  let y = startY;
  doc.setFontSize(12);
  doc.setTextColor(103, 104, 108);
  y = placeText(doc, label, margin, y, maxW, 7);
  y += 4;
  doc.setFontSize(bodySize);
  doc.setTextColor(56, 57, 61);
  let n = 1;
  for (const item of Array.isArray(items)
    ? items.filter((entry) => entry && typeof entry === "object")
    : []) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    if (item.type === "mcq") {
      y = placeText(doc, `${n}. ${item.question}`, margin, y, maxW, 5);
      y += 2;
      (item.options || []).forEach((opt, i) => {
        const line = `${String.fromCharCode(65 + i)}) ${opt}`;
        y = placeText(doc, line, margin + 4, y, maxW - 4, 5);
        y += 1;
      });
      y += 4;
    } else if (item.type === "fill_blank") {
      y = placeText(doc, `${n}. ${item.prompt}`, margin, y, maxW, 5);
      y += 2;
      y = placeText(
        doc,
        "Your answers: (fill in the blanks)",
        margin + 4,
        y,
        maxW - 4,
        5,
      );
      y += 6;
    }
    n += 1;
  }
  return y;
}

function renderAnswerKey(doc, items, margin, maxW, startY, bodySize, label) {
  let y = startY;
  doc.setFontSize(12);
  doc.setTextColor(103, 104, 108);
  y = placeText(doc, label, margin, y, maxW, 7);
  y += 4;
  doc.setFontSize(bodySize);
  doc.setTextColor(56, 57, 61);
  let k = 1;
  for (const item of Array.isArray(items)
    ? items.filter((entry) => entry && typeof entry === "object")
    : []) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    if (item.type === "mcq") {
      const letter = String.fromCharCode(65 + (item.correct_index ?? 0));
      const correct = item.options?.[item.correct_index] ?? "";
      y = placeText(doc, `${k}. ${letter}) ${correct}`, margin, y, maxW, 5);
      y += 4;
    } else if (item.type === "fill_blank") {
      const ans = Array.isArray(item.answer)
        ? item.answer.join(", ")
        : item.answer;
      y = placeText(doc, `${k}. ${ans}`, margin, y, maxW, 5);
      y += 4;
    }
    k += 1;
  }
  return y;
}

/**
 * @param {object} opts
 * @param {string} [opts.summary]
 * @param {Array} [opts.mcqItems]
 * @param {Array} [opts.fillBlankItems]
 */
export function exportQuizPdf({ summary, mcqItems, fillBlankItems, title }) {
  const doc = new jsPDF();
  const margin = 14;
  const maxW = 182;
  const bodySize = 10;
  let y = 18;

  doc.setFontSize(15);
  doc.setTextColor(56, 57, 61);
  y = placeText(doc, title || "Quiz export", margin, y, maxW, 8);
  y += 6;

  doc.setFontSize(11);
  doc.setTextColor(103, 104, 108);
  y = placeText(doc, "Summary", margin, y, maxW, 7);
  y += 2;
  doc.setFontSize(bodySize);
  doc.setTextColor(56, 57, 61);
  y = placeText(doc, summary || "(none)", margin, y, maxW, 5);
  y += 10;

  if ((mcqItems || []).length) {
    y = renderItems(
      doc,
      mcqItems,
      margin,
      maxW,
      y,
      bodySize,
      "Multiple choice",
    );
    y += 8;
  }
  if ((fillBlankItems || []).length) {
    y = renderItems(
      doc,
      fillBlankItems,
      margin,
      maxW,
      y,
      bodySize,
      "Fill in the blanks",
    );
  }

  doc.addPage();
  y = 20;
  if ((mcqItems || []).length) {
    y = renderAnswerKey(
      doc,
      mcqItems,
      margin,
      maxW,
      y,
      bodySize,
      "Answer key — Multiple choice",
    );
    y += 10;
  }
  if ((fillBlankItems || []).length) {
    renderAnswerKey(
      doc,
      fillBlankItems,
      margin,
      maxW,
      y,
      bodySize,
      "Answer key — Fill in the blanks",
    );
  }

  doc.save("quiz-export.pdf");
}
