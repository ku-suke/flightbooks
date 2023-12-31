const { chromium } = require('playwright-core');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const fsPromise = require('fs').promises;
const yaml = require('js-yaml');
const path = require('path');
const glob = require('glob');
const mkdirp = require('mkdirp');

// confg.ymlの読み込み
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
console.log(config);
const srcDir = config.src_dir;


// srcDir内の画像リソースを検索しbuild配下にコピーする（.mdは不要）
const images = glob.sync(`${srcDir}/**/*.{jpg,jpeg,png,gif,svg}`);
for (const image of images) {
    const dest = image.replace(srcDir, './build');
    mkdirp.sync(path.dirname(dest));
    fs.copyFileSync(image, dest);
}

const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/google-chrome';

const buildPDF = async function (outputFilePath) {

    console.log('Launch chromium...');
  
  const browser = await chromium.launch({executablePath:executablePath, headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  

  // ローカルのHTMLファイルを読み込む
  await page.goto(`file://${path.resolve(__dirname, 'build/output.html')}`, { waitUntil: 'load' });

  const options = {
    path: outputFilePath,
    landscape: false,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<span></span>'
  };

  await page.pdf(options);
  await browser.close();

  console.log(`PDF generated at: ${outputFilePath}`);
  await finalizePdf('./build/converted.pdf', './build/finalized.pdf');
};

async function finalizePdf(inputPath, outputPath) {
    const originalBytes = await fsPromise.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(originalBytes);

    const pages = pdfDoc.getPages();
    const { width } = pages[0].getSize();
    const fontSize = 8; // フォントサイズを調整することができます
    const startPage = config.cover ? 1 : 0; // 中表紙がある場合は1ページ目から
    for (let i = startPage; i < pages.length; i++) {
        const page = pages[i];
        // ページ番号を追加
        const pageNumber = config.cover ? i : i - 1;
        page.drawText(`${pageNumber}`, {
            x: Math.round(width/2) - (fontSize*2), // ページ中央
            y: 30, // 下端からの距離
            size: fontSize,
            color: rgb(0, 0, 0),
        });
    }
    pdfDoc.setAuthor(config.author || 'flightbooks');
    pdfDoc.setTitle(config.title || 'a flightbooks publication');
    pdfDoc.setSubject('FlightBooks');
    pdfDoc.setCreator('Flight Books factory');
    pdfDoc.setProducer('Chromium/pdf-lib.js');
    const pdfBytes = await pdfDoc.save();
    await fsPromise.writeFile(outputPath, pdfBytes);

    console.log(`Added page numbers to: ${outputPath}`);
}

buildPDF('./build/converted.pdf');