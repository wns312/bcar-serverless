import { Browser, Page, PuppeteerNode } from "puppeteer-core";
import { DynamoClient } from "../db/dynamo/DynamoClient";
import { envs } from '../configs'

type Environments = typeof envs


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

    // const page = await browser.newPage();
    // waitUntil을 사용해야 로딩이 된다.
    await page.goto(BCAR_ADMIN_LOGIN_PAGE, { waitUntil: 'load' });
    await page.evaluate((id, pw) => {
      const elements = document.getElementsByClassName('iptD')
      const idInput = elements[0]
      const pwInput = elements[1]
      idInput.setAttribute('value', id)
      pwInput.setAttribute('value', pw)
    }, ADMIN_ID, ADMIN_PW)
    await page.click('button[class="btn_login"]');
    await page.waitForNavigation({waitUntil: 'networkidle2'})
  }

  // 차량 가격 필터링 중 최대 가격 필터링을 적용 후 페이지를 이동한 뒤 로딩될 때까지 대기한다
  private async selectCarsWithMaxPrice(page: Page, maxPrice: number) {
    await page.select('select[name="c_price2"]', `${maxPrice}`);
    await page.click('input[value="검색"]')
    await page.waitForSelector('#searchList > table > tbody > tr');
  }

  // 특정 목록 페이지의 차량 번호와 등록 번호를 가져온다.
  private async getPagesCarObjects(page: Page) {
    // #searchList > table > tbody > tr:nth-child(2) > td:nth-child(1)
    // #searchList > table > tbody > tr:nth-child(2) > td:nth-child(1) > span.checkbox > input
    return await page.$$eval('#searchList > table > tbody > tr', elements => {
      return elements.map(ele => {
        const td = ele.getElementsByTagName('td')
        if (td.length) {
          const rawCarNum =  td.item(0)!.textContent!
          const carNum = rawCarNum.split('\t').filter(str => ['\n', '', '광고중\n'].includes(str) ? false : true)[0]
          const detailPageNum = td.item(0)!.querySelector('span.checkbox > input')!.getAttribute('value')
          return {
            carNum,
            detailPageNum
          }
        }
      })
    })
  }

  // a 태그의 href값을 원하는 페이지값으로 변경 후 클릭한다.
  private async movePage(page: Page, pageNum: number) {

    await page.evaluate((pageNum) => {
      const element = document.querySelector('#paging > a:nth-child(1)')!
      element.setAttribute('href', `javascript:changePagenum(${pageNum});`)
    }, pageNum)

    await page.click('#paging > a:nth-child(1)');
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

  // 진입 method
  async crawl() {
    const browser = await this.getBrowser()
    const [page] = await browser.pages();

    // await this.login(page)
    // await page.waitForTimeout(3000);
    // await this.selectCarsWithMaxPrice(page, 2000)

    // await page.waitForTimeout(3000);
    // const carObjects = await this.getPagesCarObjects(page)
    // console.log(carObjects);
    // carNum이 이미 database 안에 있다면 filter한다. (왜냐면 새로 데이터를 생성 할 필요가 없기 때문이다.)
    // filter가 끝났다면 페이지 number를 따로 저장해두고 다음 페이지로 이동해 다음 페이지의 데이터를 수집한다.
    // 모든 페이지의 수집이 완료될때까지 반복한다.
    // 전체 페이지 수를 가져오려면 판매중 차량의 개수 // 100으로 나누면 됨.
    // await this.movePage(page, 121)
    const startTime = Date.now()
    const mNoList = [8745253, 8820254, 8820255, 8745260, 8745258, 8820241, 8745248, 8820258, 8745249, 8820242, 8820259, 8745261]
    let res = mNoList.map(mNo=>{
      return this.getCarDetail(browser, mNo)
    })
    const responses = await Promise.all(res)
    const endTime = Date.now()
    console.log(responses);
    console.log(endTime - startTime);
    // 하나의 차량 긁어오는데 1초정도 걸린다.
    // 초기에는 약 12000대의 차량을 모두 긁어오는데 30분 이상 걸리지만,
    // 한번 모든 차량을 등록한 이후에는
    // 1. 로그인 후 120페이지에 달하는 모든 리스트에서 관리번호를 긁어온 후, 없는 녀석만 추가하면 되기 때문에
    // 2. 120초 + 없는 차량이 하루 100대라고 가정했을 때 100초 = 220초이므로, 약 4~5분이면 모든 차량을 업데이트 할 수 있게 된다.
    // 3. 하루 5분이면 모든 차량을 DB에 넣고 있기 충분함
    // 4. 판매된 차량을 제거하는건 천천히 하자..힘들다...
    
    
    // await browser.close()
    // setTimeout(async () => {
    //   await page.select('select[name="c_price2"]', '2000');
    //   await page.click('input[value="검색"]')
    // }, 3000);
    // await page.close()

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
