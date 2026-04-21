export interface Student {
  id: number;
  name: string;
  icon: string;
  role: 'striker' | 'special';
}

const SPREADSHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1JiiMs872eOatwOZBQn1ITqR9ccvoosUsM1SaPvuvTwk/export?format=csv";

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  fields.push(current);
  return fields;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

export async function fetchStudents(): Promise<Student[]> {
  try {
    const response = await fetch(SPREADSHEET_CSV_URL);
    if (!response.ok) throw new Error('Spreadsheet fetch failed');

    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];

    const headerFields = parseCsvLine(lines[0]).map(normalizeHeader);
    const idIndex = headerFields.findIndex(h => h === 'id' || h.includes('id'));
    const nameIndex = headerFields.findIndex(h => h.includes('name'));
    const roleIndex = headerFields.findIndex(h => h.includes('position') || h.includes('pos') || h.includes('role'));
    const iconIndex = headerFields.findIndex(h => h.includes('icon'));

    const students: Student[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = parseCsvLine(line);
      if (!parts.length) continue;

      const idStr = idIndex >= 0 ? parts[idIndex] : parts[0];
      const name = nameIndex >= 0 ? parts[nameIndex] : parts[1] || '';
      const roleValue = roleIndex >= 0 ? parts[roleIndex] : parts[3] || '';
      const iconValue = iconIndex >= 0 ? parts[iconIndex] : '';

      const id = parseInt(idStr.replace(/"/g, '').trim(), 10);
      if (isNaN(id) || !name) continue;

      const roleStr = roleValue.replace(/"/g, '').trim().toLowerCase();
      const role = roleStr === '1' || roleStr.includes('special') || roleStr.includes('spetial')
        ? 'special'
        : 'striker';

      const formattedId = id.toString().padStart(3, '0');
      let icon = iconValue.replace(/"/g, '').trim();
      if (!icon) {
        icon = `cicon_${formattedId}.png`;
      }
      if (!icon.startsWith('/')) {
        icon = `/CharacterIcon/${icon.endsWith('.png') ? icon : `${icon}.png`}`;
      }

      students.push({
        id,
        name,
        icon,
        role,
      });
    }

    return students;
  } catch (error) {
    console.error('Failed to fetch students from spreadsheet:', error);
    return [];
  }
}
