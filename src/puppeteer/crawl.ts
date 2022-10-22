import { Page, PuppeteerNode } from "puppeteer-core";
import { envs } from '../configs'

type Environments = typeof envs

type CarListObject = {
  carNum: string,
  detailPageNum: number,
  price: number
  // 여기서 원가도 리턴해주어야 함
}

type RangeChunk = {
  start: number,
  end: number
}

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

// save() {
//   const {
//     DYNAMO_DB_REGION,
//     BCAR_TABLE,
//     BCAR_INDEX,
//   } = this.envs
//   const client = new DynamoClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX);

//   throw new Error("Not implemented")
// }

export class CarListPageWaiter {
  // 여기서 무한대기 걸릴수도 있음
  async waitForSearchList(page: Page) {
    console.log("waitForSearchList start");

    let display = 'none'
    while (display === 'none') {
      display = await page.$eval('#searchList', ele => {
        return window.getComputedStyle(ele).getPropertyValue('display')
      })
    }
    console.log("waitForSearchList end");
  }
}

export class CarListPageInitializer {
  constructor(
    private envs: Environments,
    private carListPageWaiter: CarListPageWaiter) {}

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
    await this.carListPageWaiter.waitForSearchList(page)
  }

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

  async createInitializedBrowsers() {
    const browser = await this.getBrowser()
    const [page] = await browser.pages()
    await this.login(page)
    await this.selectCarsWithMaxPrice(page, 2000)

    return {
      browser,
      page
    }
  }
}


export class CarPageAmountCrawler {
  constructor(
    private carListPageInitializer: CarListPageInitializer,
    ) {}

  private createRangeChunks(pageAmount: number) {
    const rangeChunks: RangeChunk[] = []
    for (let i = 1; i < pageAmount + 1; i = i + 5) {
      rangeChunks.push({
        start: i,
        end: Math.min(i+5, pageAmount)
      })
    }
    return rangeChunks
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

  async crawl() {
    const { browser, page } = await this.carListPageInitializer.createInitializedBrowsers()
    const pageAmount = await this.getCarPages(page)
    await browser.close()
    // TODO: 5개씩 쪼개는 range의 경우 제대로 처리되지 않는다. 확인해볼 것
    return pageAmount
  }
}


export class CarListCralwer {

  constructor(
    private envs: Environments,
    private carListPageInitializer: CarListPageInitializer,
    private carListPageWaiter: CarListPageWaiter
    ) {}

  // 특정 목록 페이지의 차량 번호와 등록 번호를 가져온다.
  private async getCarListObjectsWithPage(page: Page): Promise<CarListObject[]> {
    // Error: Node is either not clickable or not an HTMLElement
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
            detailPageNum: parseInt(detailPageNum),
            price: parseInt(price)
          }
        }
      }).filter((ele):ele is CarListObject=> Boolean(ele))

    })

    return result
  }

  private async crawlRange(page: Page, startPage: number, endPage: number) {
    let catObjects: CarListObject[] = []
    for (let i = startPage; i < endPage; i++) {
      await this.movePage(page, i)
      console.log(`targetPage after move: ${i}`);
      const datas = await this.getCarListObjectsWithPage(page)
      catObjects = [...catObjects, ...datas]
    }
    return catObjects
  }

    // a 태그의 href값을 원하는 페이지값으로 변경 후 클릭한다.
    private async movePage(page: Page, pageNum: number) {
      await page.evaluate((pageNum) => {
        const element = document.querySelector('#paging > a:nth-child(1)')!
        element.setAttribute('href', `javascript:changePagenum(${pageNum});`)

      }, pageNum)
      // await page.waitForTimeout(3000);
      // 여기가 문제인 건 맞음. click이 안된다.
      await page.click('#paging > a:nth-child(1)');
      // #searchList 의 style display가 none에서 block으로 변하면 리턴하면됨
      await this.carListPageWaiter.waitForSearchList(page)
    }

  async crawlCarList(startPage: number, endPage: number) {
    const { browser, page } = await this.carListPageInitializer.createInitializedBrowsers()
    const startTime = Date.now()
    const carObjects = await this.crawlRange(page, startPage, endPage)
    const endTime = Date.now()
    console.log(endTime - startTime);
    await browser.close()
    return carObjects
  }

  async batCrawlCarListForLocal(pageSize: number) {
    const pageChunk = []
    for (let i = 1; i < pageSize; i = i+10) {
      const endPage = Math.min(i+10, pageSize)
      pageChunk.push([i, endPage])

    }
    console.log(pageChunk);

    const carListObjectList = await Promise.all(
      pageChunk.map(([startPage, endPage]) => this.crawlCarList(startPage, endPage))
    )
    return carListObjectList.reduce((list, chunk)=>[...list, ...chunk], [] as CarListObject[])
  }
}



type CarDetailObject = {
  carInfoMap: {
    [k: string]: string | boolean
  },
  carCheckSrc: string,
  carImgList: string[]
}


export class CarDetailCralwer {
  Category = "Category"
  Displacement = "Displacement"
  CarNumber = "CarNumber"
  ModelYear = "ModelYear"
  Mileage = "Mileage"
  Color = "Color"
  GearBox = "GearBox"
  FuelType = "FuelType"
  PresentationNumber = "PresentationNumber"
  HasAccident = "HasAccident"
  RegisterNumber = "RegisterNumber"
  PresentationsDate = "PresentationsDate"
  HasSeizure = "HasSeizure"
  HasMortgage = "HasMortgage"
  carInfoKeys = [
    this.Category,
    this.Displacement,
    this.CarNumber,
    this.ModelYear,
    this.Mileage,
    this.Color,
    this.GearBox,
    this.FuelType,
    this.PresentationNumber,
    this.HasAccident,
    this.RegisterNumber,
    this.PresentationsDate,
    this.HasSeizure,
    this.HasMortgage,
  ]
  constructor(private envs: Environments) {}

  private async getBrowser() {
    const chromium = require("chrome-aws-lambda");
    const puppeteer: PuppeteerNode = chromium.puppeteer
    return await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      // headless: true
      headless: chromium.headless
    });
  }

  async crawlRange(manageNums: number[]) {
    const browser = await this.getBrowser()
    try {
      const [page] = await browser.pages();
      let catObjects: CarDetailObject[] = []
      for (let i = 0; i < manageNums.length; i++) {
        const carDetail = await this.getCarDetail(page, manageNums[i])
        catObjects.push(carDetail)
      }
      console.log("done");
      await browser.close()
      return catObjects
    } catch (e) {
      console.log(e);
      await browser.close()
    }
  }

  private async getCarDetail(page: Page, manageNum: number) {
    const { BCAR_DETAIL_PAGE_TEMPLATE } = this.envs
    await page.goto(
      `${BCAR_DETAIL_PAGE_TEMPLATE}${manageNum}`,
      // 생각보다 되게 중요한 부분. Timeout Error를 피하기 위해 필요한 부분
      { waitUntil: 'networkidle2', timeout: 0 }
    )
    let data_len = await page.$$eval( "#detail_box > div.right > div > div.carContTop > ul > li", data => {
        return data.length;
    });

    let promiseCarInfoValues: Promise<string>[] = []
    for (let index = 1; index < data_len+1; index++) {
        promiseCarInfoValues.push(
            page.$eval(`#detail_box > div.right > div > div.carContTop > ul > li:nth-child(${index}) > span.txt`, (data)=>{
                return data.textContent ? data.textContent.trim() : ''
            })
        )
    }
    let carCheckSrc: string = ''
    try {
      carCheckSrc = await page.$eval(`#detail_box > div:nth-child(21) > iframe`, (element)=>{
        return element.getAttribute('src')!
      })
    } catch (error) {
      console.log("No CheckSrc");
    }


    // 이미지만 가져오기
    const imgLen = await page.$$eval(`#detail_box > div:nth-child(16) > a`, (element)=>{
        return element.length
    })
    let carImgList = []
    for (let index = 1; index < imgLen+1; index++) {
        carImgList.push(
            page.$eval(`#detail_box > div:nth-child(16) > a:nth-child(${index}) > img`, (element)=>{
                return element.getAttribute('src')!
            })
        )
    }
    // carInfoKeys = await Promise.all(carInfoKeys)
    const carInfoValues = await Promise.all(promiseCarInfoValues)
    const [HasSeizure, HasMortgage] = carInfoValues.pop()!.split(' / ')
    carImgList = await Promise.all(carImgList)
    const carInfoMap = new Map<string, string|boolean>()
    for (let i = 0; i < carInfoValues.length ; i++) {
      carInfoMap.set(this.carInfoKeys[i], carInfoValues[i])
    }
    carInfoMap.set(this.HasSeizure, HasSeizure === "없음" ? false : true)
    carInfoMap.set(this.HasMortgage, HasMortgage === "없음" ? false : true)
    console.log({
      carInfoMap,
      carCheckSrc,
      carImgList
    });
    return {
      carInfoMap : Object.fromEntries(carInfoMap),
      carCheckSrc,
      carImgList
    }
  }
}
