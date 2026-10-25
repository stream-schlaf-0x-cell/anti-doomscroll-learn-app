export function classifyArticleTopic(title: string, content: string, sourceDefaultCategory?: string): string {
    const text = (title + ' ' + content).toLowerCase();

    // Core profile topics
    const topics = {
        'KI & Apple': ['apple', 'ios', 'mac', 'iphone', 'ipad', 'ki', 'ai', 'artificial intelligence', 'künstliche intelligenz', 'gemini', 'chatgpt', 'openai', 'llm', 'machine learning', 'neural', 'algorithmus'],
        'Wissenschaft': ['wissenschaft', 'science', 'research', 'studie', 'forschung', 'physik', 'chemie', 'biologie', 'astronomie', 'medizin', 'mathematik', 'mauve', 'dye', 'perkin', 'chemistry', 'synthesis'],
        'Philosophie': ['philosophie', 'philosophy', 'ethics', 'ethik', 'moral', 'kant', 'hegel', 'nietzsche', 'sokrates', 'plato', 'wahrheit', 'existenz'],
        'Gesellschaft/Politik': ['gesellschaft', 'society', 'politik', 'politics', 'wahl', 'regierung', 'gesetz', 'demokratie', 'wirtschaft', 'soziales'],
        'Achtsamkeit': ['achtsamkeit', 'mindfulness', 'meditation', 'psychologie', 'mental', 'gesundheit', 'wellbeing', 'stress', 'ruhe', 'fokus', 'schlaf'],
        'Musik & Kreative Projekte': ['musik', 'music', 'kunst', 'art', 'kreativ', 'creative', 'design', 'kultur', 'culture', 'film', 'theater', 'literatur', 'buch'],
        'Unterrichtsbezug (Didaktik/Schule)': ['schule', 'unterricht', 'didaktik', 'pädagogik', 'education', 'lehrer', 'schüler', 'lernen', 'bildung', 'klassenraum']
    };

    let bestTopic = sourceDefaultCategory || 'Wissenschaft';
    let maxScore = 0;

    for (const [topic, keywords] of Object.entries(topics)) {
        let score = 0;
        for (const kw of keywords) {
            // Count occurrences
            const regex = new RegExp(`\\b${kw}\\b`, 'g');
            const matches = text.match(regex);
            if (matches) {
                score += matches.length;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestTopic = topic;
        }
    }

    return bestTopic;
}

export function isHighlySpecializedJargon(title: string, content: string): boolean {
    const text = (title + ' ' + content).toLowerCase();
    // A heuristic to detect dense academic jargon like "Syntaxin11", "CRAC channels", etc.
    const jargonKeywords = ['syntaxin', 'crac channel', 'allele', 'transcriptome', 'phenotype', 'phosphorylation', 'pathogenesis', 'cytokine', 'in vitro', 'in vivo', 'kinase'];

    let count = 0;
    for (const kw of jargonKeywords) {
        if (text.includes(kw)) {
            count++;
        }
    }

    // If it has multiple highly specialized terms without enough plain text framing, flag it
    return count >= 2 && text.length < 1500;
}
