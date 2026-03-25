import os
import re
import html
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER


class PDFWriter:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_styles()

    def _setup_styles(self):
        self.title_style = ParagraphStyle(
            'MinervaTitle',
            parent=self.styles['Normal'],
            fontSize=20,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#00d4aa'),
            spaceAfter=6,
        )
        self.h2_style = ParagraphStyle(
            'MinervaH2',
            parent=self.styles['Normal'],
            fontSize=13,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#1a1a2e'),
            spaceBefore=14,
            spaceAfter=6,
        )
        self.body_style = ParagraphStyle(
            'MinervaBody',
            parent=self.styles['Normal'],
            fontSize=10,
            fontName='Helvetica',
            textColor=colors.HexColor('#2d2d2d'),
            spaceAfter=6,
            leading=16,
            alignment=TA_JUSTIFY,
        )
        self.bullet_style = ParagraphStyle(
            'MinervaBullet',
            parent=self.styles['Normal'],
            fontSize=10,
            fontName='Helvetica',
            textColor=colors.HexColor('#2d2d2d'),
            spaceAfter=4,
            leftIndent=20,
            leading=14,
            alignment=TA_JUSTIFY,
        )
        self.meta_style = ParagraphStyle(
            'MinervaMeta',
            parent=self.styles['Normal'],
            fontSize=8,
            fontName='Helvetica',
            textColor=colors.HexColor('#888888'),
            spaceAfter=4,
        )
        self.url_style = ParagraphStyle(
            'MinervaURL',
            parent=self.styles['Normal'],
            fontSize=9,
            fontName='Helvetica',
            textColor=colors.HexColor('#00d4aa'),
            spaceAfter=4,
            leftIndent=20,
            leading=14,
        )
        self.table_header_style = ParagraphStyle(
            'MinervaTableHeader',
            parent=self.styles['Normal'],
            fontSize=9,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#ffffff'),
            alignment=TA_CENTER,
            leading=12,
        )
        self.table_cell_style = ParagraphStyle(
            'MinervaTableCell',
            parent=self.styles['Normal'],
            fontSize=9,
            fontName='Helvetica',
            textColor=colors.HexColor('#2d2d2d'),
            alignment=TA_LEFT,
            leading=12,
        )

    def _clean_line(self, line: str) -> str:
        """Remove markdown symbols and clean up line for PDF rendering."""
        line = re.sub(r'^#+\s*', '', line)
        line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', line)
        line = re.sub(r'\*(.*?)\*', r'<i>\1</i>', line)
        line = re.sub(r'`(.*?)`', r'\1', line)
        return line.strip()

    def _is_table_row(self, line: str) -> bool:
        """Check if a line is a markdown table row."""
        stripped = line.strip()
        return stripped.startswith('|') and stripped.endswith('|')

    def _is_separator_row(self, line: str) -> bool:
        """Check if a line is a markdown table separator (---|---|---)."""
        stripped = line.strip()
        if not self._is_table_row(stripped):
            return False
        # Contains only dashes, colons, pipes, and spaces
        inner = stripped.strip('|')
        return all(c in '-|: ' for c in inner)

    def _parse_table_row(self, line: str) -> list:
        """Parse a markdown table row into a list of cell strings."""
        stripped = line.strip().strip('|')
        cells = [html.unescape(cell.strip()) for cell in stripped.split('|')]
        return cells

    def _build_table_flowable(self, table_lines: list) -> Table:
        """
        Convert a list of markdown table row strings into a ReportLab Table.
        First row is treated as header. Separator rows are skipped.
        """
        rows = []
        is_first_data_row = True

        for line in table_lines:
            # Skip separator rows (---|---|---)
            if self._is_separator_row(line):
                continue

            cells = self._parse_table_row(line)

            if is_first_data_row:
                # Render header cells with header style
                styled_cells = [
                    Paragraph(cell, self.table_header_style)
                    for cell in cells
                ]
                rows.append(styled_cells)
                is_first_data_row = False
            else:
                styled_cells = [
                    Paragraph(cell, self.table_cell_style)
                    for cell in cells
                ]
                rows.append(styled_cells)

        if not rows:
            return None

        # Calculate equal column widths based on page content width
        # A4 width minus margins: 210mm - 2*20mm = 170mm ~ 6.7 inches
        page_content_width = 6.7 * inch
        num_cols = len(rows[0])
        col_width = page_content_width / num_cols if num_cols > 0 else page_content_width

        table = Table(
            rows,
            colWidths=[col_width] * num_cols,
            repeatRows=1,  # repeat header on page breaks
        )

        table.setStyle(TableStyle([
            # Header row background — teal
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#00d4aa')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),

            # Alternating row colors for readability
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [
                colors.HexColor('#f9f9f9'),
                colors.HexColor('#ffffff'),
            ]),

            # Grid lines
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#00d4aa')),

            # Padding
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),

            # Vertical alignment
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        return table

    def _parse_markdown(self, text: str) -> list:
        flowables = []
        lines = text.split('\n')

        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            # --- TABLE BLOCK DETECTION ---
            if self._is_table_row(stripped):
                # Collect all consecutive table rows
                table_lines = []
                while i < len(lines) and self._is_table_row(lines[i].strip()):
                    table_lines.append(lines[i].strip())
                    i += 1

                # Build and append the table flowable
                table_flowable = self._build_table_flowable(table_lines)
                if table_flowable:
                    flowables.append(Spacer(1, 8))
                    flowables.append(table_flowable)
                    flowables.append(Spacer(1, 8))
                continue

            # --- HEADING ---
            if stripped.startswith('## ') or stripped.startswith('# '):
                clean = self._clean_line(stripped)
                flowables.append(Spacer(1, 8))
                flowables.append(Paragraph(clean, self.h2_style))
                flowables.append(HRFlowable(
                    width="100%", thickness=0.5,
                    color=colors.HexColor('#e0e0e0'), spaceAfter=6
                ))

            # --- BULLET ---
            elif stripped.startswith('- ') or stripped.startswith('* '):
                content = stripped[2:].strip()
                if content.startswith('http://') or content.startswith('https://'):
                    safe_url = content.replace('&', '&amp;')
                    flowables.append(Paragraph(
                        f'• <link href="{safe_url}"><u>{safe_url}</u></link>',
                        self.url_style
                    ))
                else:
                    clean = self._clean_line(content)
                    flowables.append(Paragraph(f"• {clean}", self.bullet_style))

            # --- STANDALONE URL ---
            elif stripped.startswith('http://') or stripped.startswith('https://'):
                safe_url = stripped.replace('&', '&amp;')
                flowables.append(Paragraph(
                    f'<link href="{safe_url}"><u>{safe_url}</u></link>',
                    self.url_style
                ))

            # --- EMPTY LINE ---
            elif not stripped:
                flowables.append(Spacer(1, 6))

            # --- BODY TEXT ---
            else:
                clean = self._clean_line(stripped)
                if clean:
                    flowables.append(Paragraph(clean, self.body_style))

            i += 1

        return flowables

    def _sanitize_filename(self, query: str) -> str:
        """Convert query to a safe filename."""
        filename = re.sub(r'[^\w\s-]', '', query)
        filename = re.sub(r'\s+', '_', filename)
        filename = filename[:50].strip('_')
        return filename.lower() or "minerva_report"

    def generate(self, report_markdown: str, query: str, output_path: str) -> tuple:
        """
        Generate a PDF from markdown report content.
        Returns (output_path, filename)
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            rightMargin=0.8 * inch,
            leftMargin=0.8 * inch,
            topMargin=1 * inch,
            bottomMargin=0.8 * inch,
            title=query,
            author="Minerva",
            subject="Research Report",
        )

        story = []

        # Header
        story.append(Paragraph("Minerva", self.title_style))
        story.append(Paragraph("Research Report", self.h2_style))
        story.append(Paragraph(f"Query: {query}", self.meta_style))
        story.append(HRFlowable(
            width="100%", thickness=1,
            color=colors.HexColor('#00d4aa'), spaceAfter=16
        ))

        # Report content
        story.extend(self._parse_markdown(report_markdown))

        doc.build(story)

        safe_name = self._sanitize_filename(query)
        filename = f"minerva_{safe_name}.pdf"

        return output_path, filename