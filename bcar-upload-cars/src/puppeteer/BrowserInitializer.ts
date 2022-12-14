import * as puppeteer from "puppeteer"

// 네이밍 변경이 필요하다고 본다. Ex) BrowserController? BrowserManager?
export class BrowserInitializer {
  private _pageList: puppeteer.Page[] = []

  constructor(private nodeEnv: String){}

  get pageList() {
    return this._pageList
  }
  set pageList(pageList : puppeteer.Page[]) {
    this._pageList = pageList;
  }

  private createBrowser() {
    return puppeteer.launch({
      defaultViewport: null,
      args: ['--no-sandbox'],
      ignoreDefaultArgs: ['--disable-extensions'],
      headless: this.nodeEnv === 'prod',
      devtools: true,
    });
  }

  async initializeBrowsers(amount: number) {
    const promisePagesInitialize: Promise<puppeteer.Browser>[] = []
    for (let i = 0; i < amount; i++) {
      const browser = this.createBrowser()
      promisePagesInitialize.push(browser)

    }
    const initializedBrowsers = await Promise.all(promisePagesInitialize)
    const initializedPages = await Promise.all(
      initializedBrowsers.map(async browser=>{
        const pages = await browser.pages()
        return pages[0]
      })
    )
    this.pageList = this.pageList.concat(initializedPages)
  }

  async closePages() {
    const promiseClosedBrowsers = this.pageList.map(page => page.browser().close());
    await Promise.all(promiseClosedBrowsers)
    console.info(`Total ${promiseClosedBrowsers.length} browser(s) closed`);
  }

  // 이 친구는 여기 없는게 바람직할 것
  async login(page: puppeteer.Page, url: string, id: string, pw: string) {
    await page.goto(url, { waitUntil: "networkidle2" });

    await page.evaluate((id, pw) => {
      // 태그 바뀌어야 함: id, pw 태그를 따로 가져올 것임
      const idInput = document.querySelector('#content > form > fieldset > div.form_inputbox > div:nth-child(1) > input')
      const pwInput = document.querySelector('#content > form > fieldset > div.form_inputbox > div:nth-child(3) > input')
      if (idInput && pwInput) {
        idInput.setAttribute('value', id)
        pwInput.setAttribute('value', pw)
      } else {
        throw new Error("Cannot find id, pw input")
      }
    }, id, pw)

    await page.click("#content > form > fieldset > span > input")

    await page.waitForNavigation({waitUntil: 'networkidle2'})
  }

  // async activateScreenShot(page: puppeteer.Page, targetElementId: string) {
  //   const example = await page.$(targetElementId);
  //   const bounding_box = await example!.boundingBox();
  //   return setInterval(async ()=>{
  //     await page.screenshot({
  //       path: `./images/screenshot-${Date.now()}.jpeg`,
  //       clip: {
  //         x: bounding_box!.x,
  //         y: bounding_box!.y,
  //         width: 1000,
  //         height: 500
  //       }
  //     })
  //   }, 5000)
  // }

  async activateEvents(page: puppeteer.Page) {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => {
      console.error('Page error: ' + err.toString());
    });
    page.on('error', err => {
        console.error('Error: ' + err.toString());
    });
    page.on('requestfailed', request => {
        console.error(request.url() + ' ' + request.failure()!.errorText);
    });
    page.on("dialog", async (dialog)=>{
      await dialog.accept()
      console.log("실행 완료");
      throw Error("Cannot register cars anymore")
    })
  }


}
