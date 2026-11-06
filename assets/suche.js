'use strict';

const statusLine = document.querySelector('#search-status');
const results = document.querySelector('#search-results');
const input = document.querySelector('#search');
const query = (new URLSearchParams(location.search).get('q') || '').slice(0, 100).trim();
input.value = query;

function normalized(value) {
    return value.normalize('NFC').toLocaleLowerCase('de').replace(/ä/g, 'ae').replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFKD').replace(/\p{M}/gu, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const synonyms = [
    ['hort', 'betreuung', 'mittagsbetreuung', 'ganztagsbetreuung', 'ganztag'],
    ['einschulung', 'schuleinschreibung', 'schulanmeldung', 'schulanfang'],
    ['krankmeldung', 'krankmelden', 'krank', 'abmeldung'],
    ['sekretariat', 'kontakt', 'telefon', 'verwaltung']
];

const fillerWords = new Set([
    'am', 'an', 'auf', 'bei', 'das', 'dem', 'den', 'der', 'des', 'die', 'ein', 'eine',
    'einem', 'einen', 'einer', 'finde', 'fuer', 'ich', 'im', 'in', 'ist', 'kann', 'mein',
    'meine', 'meinem', 'meinen', 'mit', 'oder', 'sind', 'und', 'von', 'wann', 'was',
    'wie', 'wird', 'wo', 'zu', 'zum', 'zur'
]);

function searchWords(value) {
    const words = normalized(value).split(' ').filter(Boolean);
    const meaningful = words.filter(word => !fillerWords.has(word));
    return meaningful.length ? meaningful : words;
}

function score(item, terms) {
    const title = normalized(item.title);
    const titleWords = title.split(' ');
    const keywords = (item.keywords || []).map(keyword => searchWords(keyword).join(' '));
    const keywordWords = new Set(keywords.flatMap(keyword => keyword.split(' ')));
    const tags = normalized(item.tags);
    const text = normalized(item.description + ' ' + item.text);
    let weight = 0;
    for (const term of terms) {
        const alternatives = synonyms.find(group => group.includes(term)) || [term];
        const match = Math.max(...alternatives.map(word => {
            return titleWords.includes(word) ? 12 : keywordWords.has(word) ? 10 : title.includes(word) ? 8 :
                tags.includes(word) ? 6 : text.includes(word) ? 2 : 0;
        }));
        if (!match) return 0;
        weight += match;
    }
    return weight + (keywords.includes(terms.join(' ')) ? 12 : 0);
}

function editDistance(left, right) {
    const rows = Array.from({length: left.length + 1}, (_, i) => [i]);
    rows[0] = Array.from({length: right.length + 1}, (_, j) => j);
    for (let i = 1; i <= left.length; i++) {
        for (let j = 1; j <= right.length; j++) {
            const substitution = left[i - 1] === right[j - 1] ? 0 : 1;
            rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + substitution);
            if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
                rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
            }
        }
    }
    return rows[left.length][right.length];
}

function closestWord(term, vocabulary) {
    if (!/^\p{L}{4,}$/u.test(term) || vocabulary.has(term)) return term;
    let bestDistance = term.length >= 9 ? 2 : 1;
    let closest = term;
    for (const candidate of vocabulary) {
        if (Math.abs(term.length - candidate.length) > bestDistance) continue;
        const distance = editDistance(term, candidate);
        if (distance < bestDistance) {
            bestDistance = distance;
            closest = candidate;
        } else if (distance === bestDistance) {
            // Keep the original when more than one word is equally close.
            closest = closest === term ? candidate : '';
        }
    }
    return closest || term;
}

function correctedWords(terms, index) {
    const vocabulary = new Set(index.flatMap(item =>
        searchWords([item.title, item.tags, ...(item.keywords || [])].join(' '))
            .filter(word => /^\p{L}{4,}$/u.test(word))
    ));
    return terms.map(term => closestWord(term, vocabulary));
}

function rankedHits(index, terms, today) {
    const archived = item => Number(Boolean(item.archive || (item.eventEnd && item.eventEnd < today)));
    return index.map(item => ({item, weight: score(item, terms)})).filter(hit => hit.weight)
        .sort((a, b) => archived(a.item) - archived(b.item) ||
            b.weight - a.weight || a.item.title.localeCompare(b.item.title, 'de'));
}

function show(item) {
    const li = document.createElement('li');
    const heading = document.createElement('h2');
    const label = document.createElement('span');
    const link = document.createElement('a');
    const description = document.createElement('p');
    label.className = 'eyebrow';
    label.textContent = item.label;
    link.href = item.url;
    link.textContent = item.title;
    description.textContent = item.description;
    heading.append(link);
    li.append(label, heading);
    if (item.description) li.append(description);
    results.append(li);
}

async function search() {
    const terms = searchWords(query).slice(0, 10);
    if (!terms.length) {
        statusLine.textContent = 'Geben Sie einen Suchbegriff ein.';
        return;
    }
    statusLine.textContent = 'Suche läuft …';
    try {
        let entries;
        if (location.protocol === 'file:') {
            entries = JSON.parse(document.querySelector('#offline-search-index').textContent);
        } else {
            const response = await fetch('../suchindex.json', {cache: 'no-cache'});
            if (!response.ok) throw new Error('Suchindex');
            entries = await response.json();
        }
        const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Berlin'}).format(new Date());
        const index = entries.filter(item => !item.expires || item.expires >= today);
        let hits = rankedHits(index, terms, today);
        let corrected = false;
        if (!hits.length) {
            const retry = correctedWords(terms, index);
            const changes = retry.filter((word, i) => word !== terms[i]).length;
            if (changes > 0 && changes <= 2) {
                hits = rankedHits(index, retry, today);
                corrected = hits.length > 0;
            }
        }
        statusLine.textContent = hits.length
            ? (hits.length > 50 ? 'Die ersten 50 von ' + hits.length + ' Treffern' : hits.length + ' Treffer') +
                (corrected ? ' mit Tippfehlerkorrektur' : '')
            : 'Zu diesem Begriff wurde nichts gefunden.';
        hits.slice(0, 50).forEach(hit => show(hit.item));
    } catch {
        statusLine.textContent = 'Die Suche ist gerade nicht verfügbar. Bitte nutzen Sie das Menü.';
    }
}

search();

