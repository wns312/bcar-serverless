import { Browser, Page, PuppeteerNode } from "puppeteer-core";
import { DynamoClient } from "../db/dynamo/DynamoClient";
import { envs } from '../configs'

type Environments = typeof envs

type CarObject = {
  carNum: string,
  detailPageNum: string,
  price: string
  // 여기서 원가도 리턴해주어야 함
}

type RangeChunk = {
  start: number,
  end: number
}

// PageAmountCrawl
// CarListCrawl
// CarDetailCrawl로 나누어야 할 것 같음

export class CarCrawler {
  constructor(private envs: Environments) {}

  private async getBrowser() {
    const chromium = require("chrome-aws-lambda");
    const puppeteer: PuppeteerNode = chromium.puppeteer
    return await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: true
      // headless: chromium.headless
    });
  }

  // 로그인 후 로딩을 기다린다.
  private async login(page: Page) {
    const {
      BCAR_ADMIN_LOGIN_PAGE,
      ADMIN_ID,
      ADMIN_PW
    } = this.envs

    await page.goto(BCAR_ADMIN_LOGIN_PAGE, { waitUntil: 'load' });
    await page.evaluate((id, pw) => {
      const elements = document.getElementsByClassName('iptD')
      const idInput = elements[0]
      const pwInput = elements[1]
      idInput.setAttribute('value', id)
      pwInput.setAttribute('value', pw)
    }, ADMIN_ID, ADMIN_PW)
    await Promise.all([
      page.click('button[class="btn_login"]'),
      page.waitForNavigation({waitUntil: 'networkidle2'})
    ]);
    // await page.waitForTimeout(3000);
  }

  // 차량 가격 필터링 중 최대 가격 필터링을 적용 후 페이지를 이동한 뒤 로딩될 때까지 대기한다
  private async selectCarsWithMaxPrice(page: Page, maxPrice: number) {
    await page.select('select[name="c_price2"]', `${maxPrice}`);
    await page.click('input[value="검색"]')
    await this.waitForSearchList(page)
  }

  // 특정 목록 페이지의 차량 번호와 등록 번호를 가져온다.
  private async getPagesCarObjects(page: Page): Promise<CarObject[]> {
    // #searchList > table > tbody > tr:nth-child(2) > td:nth-child(1)
    // #searchList > table > tbody > tr:nth-child(2) > td:nth-child(1) > span.checkbox > input
    const result = await page.$$eval('#searchList > table > tbody > tr', elements => {


      return elements.map(ele => {
        const td = ele.getElementsByTagName('td')
        if (td.length) {
          const rawCarNum =  td.item(0)!.textContent!
          const carNum = rawCarNum.split('\t').filter(str => ['\n', '', '광고중\n'].includes(str) ? false : true)[0]
          const detailPageNum = td.item(0)!.querySelector('span.checkbox > input')!.getAttribute('value')!
          const price = td.item(6)!.childNodes[0].textContent!.replace(',', '')
          return {
            carNum,
            detailPageNum,
            price
          }
        }
      }).filter((ele):ele is CarObject=> Boolean(ele))



    })
    return result
  }

  // a 태그의 href값을 원하는 페이지값으로 변경 후 클릭한다.
  private async movePage(page: Page, pageNum: number) {

    await page.evaluate((pageNum) => {
      const element = document.querySelector('#paging > a:nth-child(1)')!
      element.setAttribute('href', `javascript:changePagenum(${pageNum});`)
    }, pageNum)
    // await page.waitForTimeout(3000);
    await page.click('#paging > a:nth-child(1)');
    // #searchList 의 style display가 none에서 block으로 변하면 리턴하면됨
    await this.waitForSearchList(page)
  }

  private async getCarDetail(browser: Browser, manageNum: number) {
    const { BCAR_DETAIL_PAGE_TEMPLATE } = this.envs
    const page = await browser.newPage();
    await page.goto(`${BCAR_DETAIL_PAGE_TEMPLATE}${manageNum}`, { waitUntil: 'load' })
    let data_len = await page.$$eval( "#detail_box > div.right > div > div.carContTop > ul > li", data => {
        return data.length;
    });

    // 차 정보 가져오는 부분
    let carInfoKeys = []
    let carInfoValues = []
    for (let index = 1; index < data_len+1; index++) {
        carInfoKeys.push(
            page.$eval(`#detail_box > div.right > div > div.carContTop > ul > li:nth-child(${index}) > span.tit`, (data)=>{
                return data.textContent ? data.textContent.trim() : ''
            })
        )
        carInfoValues.push(
            page.$eval(`#detail_box > div.right > div > div.carContTop > ul > li:nth-child(${index}) > span.txt`, (data)=>{
                return data.textContent ? data.textContent.trim() : ''
            })
        )
    }
    const carCheckSrc = await page.$eval(`#detail_box > div:nth-child(21) > iframe`, (element)=>{
        return element.getAttribute('src')
    })

    // 이미지만 가져오기
    const imgLen = await page.$$eval(`#detail_box > div:nth-child(16) > a`, (element)=>{
        return element.length
    })
    let carImgList = []
    for (let index = 1; index < imgLen+1; index++) {
        carImgList.push(
            page.$eval(`#detail_box > div:nth-child(16) > a:nth-child(${index}) > img`, (element)=>{
                return element.getAttribute('src')
            })
        )
    }
    carInfoKeys = await Promise.all(carInfoKeys)
    carInfoValues = await Promise.all(carInfoValues)
    carImgList = await Promise.all(carImgList)
    const carInfoMap = new Map<string, string>()
    for (let i = 0; i < data_len; i++) {
      carInfoMap.set(carInfoKeys[i], carInfoValues[i])
    }
    return {
      carInfoMap,
      carCheckSrc,
      carImgList
    }
  }

  private async getCarPages(page: Page) {
    const carAmount = await page.$eval<string>('#sellOpenCarCount', (ele) => {
      if (typeof ele.textContent == 'string') {
        return ele.textContent
      }
      throw new Error(`text is not string: ${typeof ele.textContent}`)
      
    })
    return Math.ceil( (parseInt(carAmount.replace(',', '')) / 100) ) + 1
  }

  private async waitForSearchList(page: Page) {
    let display = 'none'
    while (display === 'none') {
      display = await page.$eval('#searchList', ele => {
        return window.getComputedStyle(ele).getPropertyValue('display')
      })
    }
  }

  private async crawlRange(page: Page, startPage: number, endPage: number) {
    let catObjects: CarObject[] = []
    for (let i = startPage; i < endPage; i++) {
      // console.log(`targetPage before move: ${i}`);
      await this.movePage(page, i)
      console.log(`targetPage after move: ${i}`);
      const datas = await this.getPagesCarObjects(page)
      catObjects = [...catObjects, ...datas]
    }
    return catObjects
  }

  private async createInitializedPage() {
    const browser = await this.getBrowser()
    const [page] = await browser.pages()
    await this.login(page)
    await this.selectCarsWithMaxPrice(page, 2000)
    return browser
  }

  private async createInitializedBrowsers(browserSize: number) {
    const promiseBrowsers: Promise<Browser>[] = []
    for (let i = 0; i < browserSize; i++) {
      promiseBrowsers.push(this.createInitializedPage())
    }
    const browsers = await Promise.all(promiseBrowsers)
    const promiseBrowsersPages = browsers.map(browser => browser.pages())
    const browserPages = await Promise.all(promiseBrowsersPages)
    const pages = browserPages.map(pages=>pages[0])
    return {
      browsers,
      pages
    }
  }


  private createRangeChunks(pageAmount: number) {
    const rangeChunks: RangeChunk[] = []
    for (let i = 1; i < pageAmount + 1; i = i + 10) {
      rangeChunks.push({
        start: i,
        end: Math.min(i+10, pageAmount)
      })
    }
    return rangeChunks
  }

  private async asyncCrawl(browserSize: number, rangeChunks: RangeChunk[], pages: Page[]) {
    let carObjects: CarObject[] = []
    while (rangeChunks.length) {
      const endIdx = Math.min(browserSize, rangeChunks.length)
      const promiseCarObjectsChunks: Promise<CarObject[]>[] = []
      for (let i = 0; i < endIdx; i++) {
        const range = rangeChunks.pop()
        if (range) {
          const { start, end } = range
          promiseCarObjectsChunks.push(this.crawlRange(pages[i], start,end))
        }
      }
      const carObjectsChunks = await Promise.all(promiseCarObjectsChunks)
      for (const carObjectsChunk of carObjectsChunks) {
        carObjects = [...carObjects, ...carObjectsChunk]
      }
    }
    return carObjects
  }

  async crawlCarList(browserSize: number) {
    const { browsers, pages } = await this.createInitializedBrowsers(browserSize)
    const pageAmount = await this.getCarPages(pages[0])

    const rangeChunks = this.createRangeChunks(pageAmount)
    console.log(rangeChunks);

    const startTime = Date.now()
    const carObjects = await this.asyncCrawl(browserSize, rangeChunks, pages)
    const endTime = Date.now()
    console.log(endTime - startTime);

    const closed = browsers.map(browser=>browser.close())
    await Promise.all(closed)

    return carObjects
  }

  // 진입 method
  async crawlTest() {
    const browser = await this.createInitializedPage()
    const [page] = await browser.pages()
    const carObject = await this.crawlRange(page, 1, 2)
    console.log(carObject);
    
    await browser.close()
    // 결과적으로 진행되어야 하는 순서
    // 1. 로그인 후 2000만원 설정 후 클릭
    // 2. 로딩을 기다린 후 판매중인 대수를 가져와서 몫연산으로 전체 페이지 수를 구한다.
    // 3. 전체 페이지 개수를 저장한다.
    // (이 때 처음 탭은 1페이지를 저장하는데 사용하지 않는다. 관심사의 분리를 명확히 하기 위한 것)
    // 4. 이제 각 페이지 수만큼 자손 탭을 생성한다
    // 5. 자손 탭들은 가격 2000만원 설정 후 각 페이지로 이동한다.
    // 6. 각 페이지에서 자손 탭들은 차량번호, 등록번호, 원가를 가져온다.
    // 7. 각 결과값은 리스트에 넣는다.
    // 8. Promise.all()로 전체 데이터를 최종적으로 수집해서 가져온다.
    // 9. 데이터베이스에 저장 후 종료
  }

  save() {
    const {
      DYNAMO_DB_REGION,
      BCAR_TABLE,
      BCAR_INDEX,
    } = this.envs
    const client = new DynamoClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX);

    throw new Error("Not implemented")
  }
}
