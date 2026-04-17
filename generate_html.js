const fs = require('fs');
const marked = require('marked');
const markedhl = require("marked-highlight");
const hljs = require('highlight.js');
const yaml = require('js-yaml');
const ejs = require('ejs');

// YAMLの設定を読み込む
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const srcDir = config.src_dir;

// カスタムレンダラの設定
const headerList = [];
const renderer = new marked.Renderer();
let chapterCount = 0; // h1のカウント
let sectionCount = 0; // h2のカウント
let subsectionCount = 0; // h3のカウント
let numberingEnabled = true; // 章番号を振るかどうか
// 章のレンダリング（回数をカウント）
renderer.heading = function (text, level) {
    let prefixedText = text;
    let id = "";

    if (!numberingEnabled) {
        id = `header-${headerList.length + 1}`;
    } else if (level === 1) { // h1
        chapterCount++;
        sectionCount = 0; // h1が新しく始まったら、h2のカウントをリセット
        subsectionCount = 0; // h1が新しく始まったら、h3のカウントをリセット
        prefixedText = `第${chapterCount}章 ${text}`;
        id = `chapter-${chapterCount}`;
    } else if (level === 2) { // h2
        sectionCount++;
        subsectionCount = 0; // h2が新しく始まったら、h3のカウントをリセット
        prefixedText = `${chapterCount}-${sectionCount} ${text}`;
        id = `chapter-${chapterCount}-section-${sectionCount}`;
    } else {
        subsectionCount++;
        id = `header-${chapterCount}-${sectionCount}-${subsectionCount}`;
    }
    headerList.push({ level, text: prefixedText, id });
    return `<h${level} id="${id}">${prefixedText}</h${level}>\n`;
};
// Super cheap sanitizer
function sanitize(str) {
    return str.replace(/&<"/g, function (m) {
        if (m === "&") return "&amp;";
        if (m === "<") return "&lt;";
        return "&quot;";
    });
}
renderer.image = function (href, title, text) {
    if (href === null) {
        return text;
    }
    var out =
        '<figure><img src="' +
        sanitize(href) +
        '" alt="' +
        sanitize(text) +
        '"';
    if (title) {
        out += ' title="' + title + '"';
    }
    out += this.options.xhtml ? "/>" : ">";
    out += "<figcaption>" + text + "</figcaption></figure>";
    return out;
};

marked.use(markedhl.markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    }
}));
marked.use({
    gfm: true,
    sanitize: true,
    renderer: renderer
});

let finalHtml = '<!DOCTYPE html><html lang="ja">';

// ヘッダーのレンダリング
const templateHeader = fs.readFileSync('./template/block_style.ejs', 'utf8');
const headerStyle = ejs.render(templateHeader, {
    title: config.title,
    paper: config.paper
});
finalHtml += '<head><meta charset="utf-8">' + headerStyle + '</head><body>';

// ソースディレクトリと各章のファイル名を取得
const chapters = config.chapters;

// はじめにページのHTMLを先に作成（章番号は付与しない）
let introductionHtml = '';
if (config.introduction) {
    const templateContent = fs.readFileSync('./template/block_introduction.ejs', 'utf8');
    const introductionMarkdown = fs.readFileSync(`${srcDir}/${config.introduction}`, 'utf8');
    numberingEnabled = false;
    const introMarked = marked.parse(introductionMarkdown);
    numberingEnabled = true;
    introductionHtml = ejs.render(templateContent, {
        introMarked: introMarked,
        firstReleaseDate: config.first_release_date,
    });
}

// 各章を1つずつビルド
let chapterHtml = '';
chapters.forEach(chapterFile => {
    const chapterCount = chapters.indexOf(chapterFile) + 1;
    const filePath = `${srcDir}/${chapterFile}`;
    const mdContent = fs.readFileSync(filePath, 'utf8');
    const chapterHtmlContent = marked.parse(mdContent);

    // テンプレートとデータを組み合わせて最終的なHTMLを生成
    const fullHtmlContent = renderPageTemplate(chapterHtmlContent, chapterCount);
    chapterHtml += fullHtmlContent;
});
// まだfinalHtmlには入れない

// 終わりにページのHTML
let conclusionHtml = '';
if (config.conclusion) {
    const templateContent = fs.readFileSync('./template/block_conclusion.ejs', 'utf8');
    const conclusionMarkdown = fs.readFileSync(`${srcDir}/${config.conclusion}`, 'utf8');
    const conclusionMarked = marked.parse(conclusionMarkdown);
    conclusionHtml = ejs.render(templateContent, {
        conclusionMarked: conclusionMarked
    });
}

const TOC_PLACEHOLDER = '<!--TOC_PLACEHOLDER-->';

// Coverページのレンダリング
if (config.cover) {
    const templateContent = fs.readFileSync('./template/block_cover.ejs', 'utf8');
    const cover = ejs.render(templateContent, {
        title: config.title,
        author: config.author
    });
    finalHtml += cover;
}

// はじめにページ（事前に生成済み）
finalHtml += introductionHtml;

// 目次は最後にまとめて挿入するためプレースホルダを配置
if (config.toc) {
    finalHtml += TOC_PLACEHOLDER;
}

// 本文のレンダリング
finalHtml += '<div class="content-body">'+chapterHtml+'</div>';

// 終わりにページ（事前に生成済み）
finalHtml += conclusionHtml;

// 奥付のレンダリング
if (config.imprint) {
    const templateContent = fs.readFileSync('./template/block_imprint.ejs', 'utf8');
    const imprint = ejs.render(templateContent, {
        title: config.title,
        firstReleaseDate: config.first_release_date,
        author: config.author,
        printAt: config.print_at,
        copyright: config.copyright
    });
    finalHtml += imprint;
}

finalHtml += '</body></html>';
if (config.toc) {
    finalHtml = finalHtml.replace(TOC_PLACEHOLDER, renderToc(headerList));
}
if (!fs.existsSync('./build')){
    fs.mkdirSync('./build', { recursive: true });
}
fs.writeFileSync('./build/output.html', finalHtml);

/**
 * Rendering Page template
 * @param {string} content
 * @param {number} chapter
 * return {string} html
 */
function renderPageTemplate(content, chapter) {
    const templateContent = fs.readFileSync('./template/block_page.ejs', 'utf8');
    const html = ejs.render(templateContent, {
        content: content,
        chapter: chapter
    });
    return html;
}

function renderToc(headerList) {
    let level = 0;
    let tag = "<div id='toc'>";

    for (var h = 0; h < headerList.length; h++) {
        let header = headerList[h];
        if (header.level < level) {
            for (var i = 0; i < level - header.level; i++) {
                tag += "</ul>\n";
            }
        }
        if (header.level > level) {
            tag += "<ul class='toclevel" + header.level + "'>";
        }

        tag += "<li>" + header.text + "</li>";
        level = header.level;
    }

    if (0 < level) {
        for (var i = 0; i < level; i++) {
            tag += "</ul>";
        }
    }
    tag += "</div>";
    return tag;
}
