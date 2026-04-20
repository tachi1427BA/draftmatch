export interface Student {
  id: number;
  name: string;
  icon: string;
  role: 'striker' | 'special';
}

const SPREADSHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1JiiMs872eOatwOZBQn1ITqR9ccvoosUsM1SaPvuvTwk/export?format=csv";

export async function fetchStudents(): Promise<Student[]> {
  try {
    const response = await fetch(SPREADSHEET_CSV_URL);
    if (!response.ok) throw new Error("Spreadsheet fetch failed");
    
    const csvText = await response.text();
    const lines = csvText.split(/\r?\n/);
    const students: Student[] = [];
    
    // 1行目はヘッダーとしてスキップ
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // カンマ区切りのパース (単純なケース)
      // カンマを含む名前に対応するため、簡易的な正規表現パースを使用
      const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!parts || parts.length < 2) continue;
      
      const idStr = parts[0].replace(/"/g, '');
      const name = parts[1].replace(/"/g, '');
      const roleStr = parts[2]?.replace(/"/g, '').trim().toLowerCase();
      const id = parseInt(idStr);
      const role = roleStr === 'special' ? 'special' : 'striker';
      
      if (!isNaN(id) && name) {
        // IDを3桁の文字列に変換してパスを生成 (例: 1 -> 001)
        const formattedId = id.toString().padStart(3, '0');
        students.push({
          id,
          name,
          icon: `/CharacterIcon/cicon_${formattedId}.png`,
          role,
        });
      }
    }
    
    return students;
  } catch (error) {
    console.error("Failed to fetch students from spreadsheet:", error);
    // 失敗した場合は最低限の空配列を返すか、キャッシュされたものを使う
    return [];
  }
}
