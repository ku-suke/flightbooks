const fs = require('fs');
const marked = require('marked');
const yaml = require('js-yaml');
const ejs = require('ejs');

const PAPERSIZE = {
    print: "size: 182mm 257mm; margin: 18mm 20mm 17mm 20mm;",
    prepress: "size: 210mm 297mm; margin: 38mm 34mm 37mm 34mm;",
    ebook: "size: 126mm 177mm; margin: 4mm 4mm 12mm;"
};
const PAPERHEIGHT = {
    print: "194",
    prepress: "194",
    ebook: "150"
};
// YAMLの設定を読み込む
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
const srcDir = config.src_dir;

// カスタムレンダラの設定
const headerList = [];
const renderer = new marked.Renderer();
let chapterCount = 0; // h1のカウント
let sectionCount = 0; // h2のカウント
let subsectionCount = 0; // h3のカウント
// 章のレンダリング（回数をカウント）
renderer.heading = function (text, level) {
    let prefixedText = text;
    let id = "";

    if (level === 1) { // h1
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

marked.setOptions({
    renderer: renderer,
    highlight: function (code) {
        return require("highlight.js").highlightAuto(code).value;
    }
});

let finalHtml = '<!DOCTYPE html><html lang="ja">';

// ヘッダーのレンダリング
const templateHeader = fs.readFileSync('./template/block_style.ejs', 'utf8');
const headerStyle = ejs.render(templateHeader, {
    title: config.title,
    paperSize: PAPERSIZE[config.paper],
    paperHeight: PAPERHEIGHT[config.paper]
});
finalHtml += '<head><meta charset="utf-8">' + headerStyle + '</head><body>';

// ソースディレクトリと各章のファイル名を取得
const chapters = config.chapters;

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

// Coverページのレンダリング
if (config.cover) {
    const templateContent = fs.readFileSync('./template/block_cover.ejs', 'utf8');
    const cover = ejs.render(templateContent, {
        title: config.title,
        author: config.author
    });
    finalHtml += cover;
}

// はじめにページのレンダリング
if (config.introduction) {
    const templateContent = fs.readFileSync('./template/block_introduction.ejs', 'utf8');
    const introductionMarkedown = fs.readFileSync(srcDir + '/' + config.introduction, 'utf8')
    const introduction = ejs.render(templateContent, {
        introMarked: marked.parse(introductionMarkedown),
        firstReleaseDate: config.first_release_date,
    });
    finalHtml += introduction;
}

// headerListを使用して目次のレンダリング
if (config.toc) {
    finalHtml += renderToc(headerList);
}

// 本文のレンダリング
finalHtml += '<div class="content-body">'+chapterHtml+'</div>';

// 終わりにページのレンダリング
if (config.conclusion) {
    const templateContent = fs.readFileSync('./template/block_conclusion.ejs', 'utf8');
    const conclusionMarkedown = fs.readFileSync(srcDir + '/' + config.conclusion, 'utf8');
    const conclusion = ejs.render(templateContent, {
        conclusionMarked: marked.parse(conclusionMarkedown),
        lastReleaseDate: config.last_release_date,
    });
    finalHtml += conclusion;
}

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