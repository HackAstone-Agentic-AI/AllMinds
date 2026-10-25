"""Shared helpers: matplotlib diagram primitives + ReportLab document scaffolding."""
import os
import tempfile
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image, Table,
                                TableStyle, PageBreak, KeepTogether, ListFlowable, ListItem)

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FIG_DIR = os.path.join(tempfile.gettempdir(), "allminds_doc_figs")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(FIG_DIR, exist_ok=True)

# ── palette ──────────────────────────────────────────────────────────────────
C = {
    "fe": "#DCEBFB", "fe_e": "#2F6FB3",
    "be": "#E3F4E1", "be_e": "#3C8A3A",
    "ai": "#F6E6FA", "ai_e": "#8A3FA0",
    "db": "#FFF1D6", "db_e": "#B7791F",
    "ext": "#EEEEEE", "ext_e": "#555555",
    "warn": "#FDE2E1", "warn_e": "#B23B3B",
    "ink": "#1F2933",
}


# ── diagram primitives ───────────────────────────────────────────────────────
def canvas(w=11, h=6.5):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")
    return fig, ax


def box(ax, x, y, w, h, text, kind="fe", fs=9, bold_first=True, align="center"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.4,rounding_size=1.2",
                                fc=C[kind], ec=C[kind + "_e"], lw=1.6))
    lines = text.split("\n")
    upp = (ax.get_ylim()[1] - ax.get_ylim()[0]) / (ax.figure.get_figheight() * 72 * ax.get_position().height)
    if bold_first and len(lines) > 1:
        body_h = (len(lines) - 1) * (fs - 0.5) * 1.3 * upp
        title_h = (fs + 1) * 1.25 * upp
        top = y + h / 2 + (body_h + title_h) / 2
        ax.text(x + w / 2, top, lines[0], ha="center", va="top", fontsize=fs + 1,
                fontweight="bold", color=C["ink"])
        ax.text(x + w / 2 if align == "center" else x + 1.2, top - title_h,
                "\n".join(lines[1:]), ha=align, va="top", fontsize=fs - 0.5, color=C["ink"],
                linespacing=1.3)
    else:
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs,
                fontweight="bold" if bold_first else "normal", color=C["ink"])
    return (x, y, w, h)


def region(ax, x, y, w, h, label, kind="fe"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.3,rounding_size=2",
                                fc="none", ec=C[kind + "_e"], lw=1.2, ls="--"))
    ax.text(x + 1, y + h - 1, label, ha="left", va="top", fontsize=9, style="italic",
            color=C[kind + "_e"], fontweight="bold")


def arrow(ax, p1, p2, label="", color="#333333", fs=7.5, both=False, ls="-", off=(0, 1.4), rad=0.0):
    style = "<|-|>" if both else "-|>"
    ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle=style, mutation_scale=12, color=color,
                                 lw=1.3, ls=ls, connectionstyle=f"arc3,rad={rad}"))
    if label:
        mx, my = (p1[0] + p2[0]) / 2 + off[0], (p1[1] + p2[1]) / 2 + off[1]
        ax.text(mx, my, label, ha="center", va="bottom", fontsize=fs, color=color,
                bbox=dict(fc="white", ec="none", alpha=0.85, pad=0.6))


def save(fig, name, title=None):
    if title:
        fig.suptitle(title, fontsize=12, fontweight="bold", color=C["ink"], y=0.98)
    path = os.path.join(FIG_DIR, name)
    fig.savefig(path, dpi=170, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def sequence(name, actors, msgs, title=None, w=11, row_h=6.2, kinds=None, notes=None):
    """Simple sequence diagram. msgs = (from_idx, to_idx, label[, style]); style 'r' = return."""
    h_units = 18 + row_h * len(msgs)
    fig, ax = plt.subplots(figsize=(w, max(4, h_units * 0.075)))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, h_units)
    ax.axis("off")
    n = len(actors)
    xs = [8 + i * (84 / (n - 1)) for i in range(n)]
    kinds = kinds or ["fe"] * n
    top = h_units - 3
    for x, a, k in zip(xs, actors, kinds):
        ax.add_patch(FancyBboxPatch((x - 7.5, top - 6), 15, 6, boxstyle="round,pad=0.3,rounding_size=1",
                                    fc=C[k], ec=C[k + "_e"], lw=1.4))
        ax.text(x, top - 3, a, ha="center", va="center", fontsize=8, fontweight="bold")
        ax.plot([x, x], [2, top - 6], color="#AAAAAA", lw=1, ls="--")
    y = top - 6 - row_h * 0.7
    for m in msgs:
        f, t, lab = m[0], m[1], m[2]
        ret = len(m) > 3 and m[3] == "r"
        if f == t:
            ax.add_patch(FancyArrowPatch((xs[f], y + 1), (xs[f] + 6, y - 1.5), arrowstyle="-|>",
                                         mutation_scale=10, color=C["ai_e"], lw=1.1,
                                         connectionstyle="arc3,rad=-0.6"))
            ax.text(xs[f] + 7, y - 0.3, lab, fontsize=7.2, va="center", ha="left", color=C["ai_e"])
        else:
            ax.add_patch(FancyArrowPatch((xs[f], y), (xs[t], y), arrowstyle="-|>", mutation_scale=11,
                                         color="#777777" if ret else "#222222", lw=1.2,
                                         ls="--" if ret else "-"))
            ax.text((xs[f] + xs[t]) / 2, y + 0.5, lab, ha="center", va="bottom", fontsize=7.2,
                    color="#555555" if ret else "#111111")
        y -= row_h
    if title:
        ax.set_title(title, fontsize=11, fontweight="bold", color=C["ink"])
    return save(fig, name)


# ── ReportLab scaffolding ────────────────────────────────────────────────────
ss = getSampleStyleSheet()
ST = {
    "title": ParagraphStyle("t", parent=ss["Title"], fontSize=24, leading=29, textColor=colors.HexColor("#1F3A5F")),
    "sub": ParagraphStyle("s", parent=ss["Normal"], fontSize=12, leading=16, textColor=colors.HexColor("#4A5568"),
                          alignment=1),
    "h1": ParagraphStyle("h1", parent=ss["Heading1"], fontSize=17, leading=21, textColor=colors.HexColor("#1F3A5F"),
                         spaceBefore=10, spaceAfter=6),
    "h2": ParagraphStyle("h2", parent=ss["Heading2"], fontSize=13, leading=16, textColor=colors.HexColor("#2F6FB3"),
                         spaceBefore=8, spaceAfter=4),
    "h3": ParagraphStyle("h3", parent=ss["Heading3"], fontSize=11, leading=14, textColor=colors.HexColor("#333333"),
                         spaceBefore=6, spaceAfter=2),
    "p": ParagraphStyle("p", parent=ss["BodyText"], fontSize=9.6, leading=13.4, spaceAfter=5),
    "cap": ParagraphStyle("cap", parent=ss["Italic"], fontSize=8.5, leading=11, alignment=1,
                          textColor=colors.HexColor("#555555"), spaceAfter=10),
    "cell": ParagraphStyle("cell", parent=ss["BodyText"], fontSize=8, leading=10),
    "cellb": ParagraphStyle("cellb", parent=ss["BodyText"], fontSize=8, leading=10, fontName="Helvetica-Bold",
                            textColor=colors.white),
    "q": ParagraphStyle("q", parent=ss["BodyText"], fontSize=9.6, leading=13, fontName="Helvetica-Bold",
                        textColor=colors.HexColor("#1F3A5F"), spaceBefore=6, spaceAfter=1),
    "a": ParagraphStyle("a", parent=ss["BodyText"], fontSize=9.2, leading=12.6, leftIndent=12, spaceAfter=4,
                        textColor=colors.HexColor("#2D3748")),
    "code": ParagraphStyle("code", parent=ss["Code"], fontSize=7.6, leading=9.6, backColor=colors.HexColor("#F4F6F8"),
                           borderPadding=5, leftIndent=4, rightIndent=4, spaceAfter=8),
    "note": ParagraphStyle("note", parent=ss["BodyText"], fontSize=8.8, leading=12, backColor=colors.HexColor("#FFF8E6"),
                           borderPadding=6, borderColor=colors.HexColor("#E0B252"), borderWidth=0.6,
                           spaceBefore=4, spaceAfter=8),
}


class Doc:
    def __init__(self, filename, title, subtitle):
        self.path = os.path.join(OUT_DIR, filename)
        self.title = title
        self.story = []
        self.fig_n = 0
        self.tab_n = 0
        self.story += [Spacer(1, 5 * cm), Paragraph("AllMinds", ST["sub"]), Spacer(1, 6),
                       Paragraph(title, ST["title"]), Spacer(1, 8), Paragraph(subtitle, ST["sub"]),
                       Spacer(1, 1.2 * cm),
                       Paragraph("Neurodivergent-affirming AI teaching companion &mdash; HackAstone Agentic AI",
                                 ST["sub"]),
                       Spacer(1, 4),
                       Paragraph("Generated from the source of the HackAstone-Agentic-AI/AllMinds repository", ST["sub"]),
                       PageBreak()]

    def h1(self, t): self.story.append(Paragraph(t, ST["h1"]))
    def h2(self, t): self.story.append(Paragraph(t, ST["h2"]))
    def h3(self, t): self.story.append(Paragraph(t, ST["h3"]))
    def p(self, t): self.story.append(Paragraph(t, ST["p"]))
    def note(self, t): self.story.append(Paragraph(t, ST["note"]))
    def code(self, t): self.story.append(Paragraph(t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                                                     .replace("\n", "<br/>").replace("  ", "&nbsp;&nbsp;"), ST["code"]))
    def br(self): self.story.append(PageBreak())

    def bullets(self, items):
        self.story.append(ListFlowable([ListItem(Paragraph(i, ST["p"]), leftIndent=12) for i in items],
                                       bulletType="bullet", start="•", leftIndent=12))

    def fig(self, path, caption, width=17):
        from reportlab.lib.utils import ImageReader
        iw, ih = ImageReader(path).getSize()
        w = width * cm
        h = w * ih / iw
        max_h = 22 * cm
        if h > max_h:
            h = max_h
            w = h * iw / ih
        self.fig_n += 1
        self.story.append(KeepTogether([Image(path, width=w, height=h),
                                        Paragraph(f"Figure {self.fig_n}. {caption}", ST["cap"])]))

    def table(self, rows, widths, caption=None, head_color="#2F6FB3"):
        data = [[Paragraph(str(c), ST["cellb"] if i == 0 else ST["cell"]) for c in r] for i, r in enumerate(rows)]
        t = Table(data, colWidths=[w * cm for w in widths], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(head_color)),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F6FA")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C9D3DF")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        self.story.append(t)
        if caption:
            self.tab_n += 1
            self.story.append(Paragraph(f"Table {self.tab_n}. {caption}", ST["cap"]))
        else:
            self.story.append(Spacer(1, 8))

    def qa(self, items):
        for i, (q, a) in enumerate(items, 1):
            self.story.append(KeepTogether([Paragraph(f"Q{i}. {q}", ST["q"]), Paragraph(a, ST["a"])]))

    def build(self):
        title = self.title

        def deco(canv, doc):
            canv.saveState()
            canv.setFont("Helvetica", 7.5)
            canv.setFillColor(colors.HexColor("#718096"))
            if doc.page > 1:
                canv.drawString(2 * cm, 1.2 * cm, f"AllMinds  |  {title}")
                canv.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Page {doc.page}")
                canv.setStrokeColor(colors.HexColor("#CBD5E0"))
                canv.line(2 * cm, A4[1] - 1.3 * cm, A4[0] - 2 * cm, A4[1] - 1.3 * cm)
            canv.restoreState()

        SimpleDocTemplate(self.path, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm,
                          bottomMargin=1.8 * cm, title=f"AllMinds - {title}", author="AllMinds team").build(
            self.story, onFirstPage=deco, onLaterPages=deco)
        return self.path


def system_overview_figure(name="overview.png"):
    """The whole system on one page; shared by all three PDFs."""
    fig, ax = canvas(12, 7.4)
    region(ax, 1, 60, 30, 38, "PRESENTATION (Next.js 13, :3000)", "fe")
    box(ax, 3, 80, 26, 13, "Browser (teacher)\nReact pages, Tailwind,\nJWT in localStorage", "fe")
    box(ax, 3, 63, 26, 13, "Next.js server\nroute /api/agent/chat\n(server-side proxy, 185 s)", "fe")
    region(ax, 35, 60, 30, 38, "API + AUTH (Express 4, :5000)", "be")
    box(ax, 37, 80, 26, 13, "Express REST API\n14 route groups, helmet,\nCORS, rate limits", "be")
    box(ax, 37, 63, 26, 13, "Auth layer\nbcrypt + JWT (7d)\nPassport OAuth", "be")
    region(ax, 69, 30, 30, 68, "AGENTS (FastAPI, :8000)", "ai")
    box(ax, 71, 80, 26, 13, "POST /chat\nguardrails + auth check\n-> run_multi_agent()", "ai")
    box(ax, 71, 63, 26, 13, "Supervisor router\nGroq Llama-3.3-70B\n(or tool_hint bypass)", "ai")
    box(ax, 71, 33, 26, 26, "8 worker agents\ngeneral | lesson | visual\nmultimodal | parent | rag\nanalytics | schedule\n(Gemini 2.5 family)", "ai")
    box(ax, 35, 35, 30, 18, "PostgreSQL (allminds_db)\nusers, teacher_profiles,\nlearner_profiles, progress,\nlesson_plans, tokens...", "db")
    box(ax, 3, 6, 20, 14, "Google / Microsoft\n/ Apple OAuth", "ext")
    box(ax, 26, 6, 20, 14, "Google Calendar API\n+ Gmail userinfo", "ext")
    box(ax, 49, 6, 22, 14, "Gemini API\n2.5 Flash / Pro / Image", "ext")
    box(ax, 74, 6, 24, 14, "Groq API  |  YouTube\nData API v3  |  ChromaDB\n+ MiniLM (DCAPS.pdf)", "ext")
    arrow(ax, (16, 79.5), (16, 76.5))
    arrow(ax, (29.5, 87), (36.5, 87), "REST + Bearer JWT")
    arrow(ax, (29.5, 69), (36.5, 69), "/api/agent/chat")
    arrow(ax, (63.5, 71), (70.5, 84), "POST /chat\n(180 s timeout)", off=(-1.5, 3))
    arrow(ax, (70.5, 81), (63.5, 67), "verify JWT:\nGET /auth/profile", off=(1, -11), color=C["ai_e"])
    arrow(ax, (84, 79.5), (84, 76.5))
    arrow(ax, (84, 62.5), (84, 59.5))
    arrow(ax, (50, 62.5), (50, 53.5), "pg Pool (max 20)", both=True)
    arrow(ax, (70.5, 40), (65.5, 42), "calendar tokens\n(psycopg2)", off=(0, 1), color=C["ai_e"])
    arrow(ax, (42, 62.5), (14, 20.5), "Passport", rad=0.15, off=(-6, -6))
    arrow(ax, (45, 34.5), (37, 20.5), "Calendar OAuth/events", off=(-4, 0))
    arrow(ax, (78, 32.5), (62, 20.5), "LLM / image", off=(0, 0))
    arrow(ax, (88, 32.5), (86, 20.5), "route, search,\nretrieve", off=(4, 0))
    return save(fig, name, "AllMinds - end-to-end system architecture")
