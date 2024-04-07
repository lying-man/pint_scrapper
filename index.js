const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

//server code
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cors());

app.get("/api", (req, res) => res.json({text: "working"}));

app.post("/api/parse", async (req, res) => {
    const { profileName, amountParsePins, access } = req.body;

    //check access user
    if (process.env.ACCESS !== access) return res.json({ error: "Access denieded" });

    try {

        let result = await startParser(profileName, amountParsePins);
        res.json(result);

    } catch(e) { res.json(e); }

});

const pinterestPath = "https://pinterest.com";

const startParser = async (username, needParsePinsCount, needArgs = false) => {

    if (!username?.trim()) return { error: "profilename_error" };

    //check parse pins count
    if (needParsePinsCount) {
        if (!(!isNaN(needParsePinsCount) && Number(needParsePinsCount) > 0)) return { error: "pinscount_error" };
    }

    //const myProxy = "196.16.108.112:8000";

    //connect proxy
    const browser = await puppeteer.launch({ headless: true, args: needArgs ? [ `--proxy-server=${myProxy}` ] : [] }); 
    const profilePage = await browser.newPage();

    //final data and counter scrapped pins
    let result = [];
    let savedLinks = [];

    try {

        //transfer to profile
        const profilePath = pinterestPath + `/${username}/_created`;

        await profilePage.goto(profilePath);
        await profilePage.waitForSelector('a.Wk9.xQ4.CCY.S9z.DUt.kVc.Tbt.L4E.e8F.BG7');

        await delay(randomIntFromInterval(2, 4));

        //check a correct profile name
        let currentPath = await profilePage.url();
        if (currentPath.includes("?show_error=true")) throw new Error("error");

        //scrap pin links and pin images
        let conditionValue = needParsePinsCount || 100000;
        while (result.length < conditionValue) {

            await delay(3, 6);

            let pinLinks = await profilePage.$$eval('[href^="/pin/"]', (links) => {
                return links.map(el => el.getAttribute("href")); 
            });

            //check unique links
            pinLinks = filterUniqueLinks(pinLinks);
            let newLinks = pinLinks.filter(el => !savedLinks.includes(el)); 
            if (!newLinks.length) break;
            savedLinks = pinLinks;

            const stepData = [];

            //parse finded pins data
            for (let link of newLinks) {

                const pinPage = await browser.newPage();
                await pinPage.goto(pinterestPath + link);
                await pinPage.waitForSelector("img.hCL.kVc.L4E.MIw");

                const parsedSrc = await pinPage.$eval('img.hCL.kVc.L4E.MIw', (el) => el.getAttribute("src"));
                let parsedTitle = null;
                let parsedDescription = null;

                //handle parse title
                try {
                    parsedTitle = await pinPage.$eval('h1.lH1.dyH.iFc.H2s.GTB.X8m.zDA.IZT', (el) => el.textContent || "Нет заголовка");
                } catch { parsedTitle = "Нет заголовка" }

                //handle parse description
                try {
                    parsedDescription = await pinPage.$eval('div[dir="auto"] div.tBJ.dyH.iFc.sAJ.X8m.zDA.IZT.swG.CKL', (el) => el.textContent || "Нет описания");
                } catch { parsedDescription = "Нет заголовка" }

                stepData.push({ imgSrc: parsedSrc, title: parsedTitle, description: parsedDescription });
                pinPage.close();

                await delay(randomIntFromInterval(1, 2));

            }

            result = [ ...result, ...stepData ];
            await profilePage.evaluate("window.scrollTo(0, document.body.scrollHeight)");

        }   

    } catch(err) {
        return { error: "content_code" };
    }

    //correct data length
    if (needParsePinsCount) result.length = needParsePinsCount;

    browser.close();
    return result;

}

//delay functionality
function randomIntFromInterval(min, max) { return Math.floor(Math.random() * (max - min + 1) + min) }
async function delay(ms) { return new Promise((res) => setTimeout(res, ms * 1000)) }

function filterUniqueLinks(list) { return Array.from(new Set(list)); }

//launch server
app.listen(PORT, () => console.log("server has been on port " + PORT));

module.exports = app;