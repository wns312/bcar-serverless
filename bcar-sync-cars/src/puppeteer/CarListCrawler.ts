import { Page } from "puppeteer-core";
import { fromUtf8, toUtf8 } from "@aws-sdk/util-utf8-node";
import { LambdaClient, InvokeCommand, InvokeCommandOutput } from "@aws-sdk/client-lambda";

import { CarListPageInitializer } from "./CarListPageInitializer"
import { CarListPageWaiter } from "./CarListPageWaiter"
import { CarListObject } from "../types"
import { rangeChunk } from "../utils"

export class CarListCollectorLambda {

  constructor(
    private lambdaClient: LambdaClient,
    ) {}

  createCrawlListInvokeCommands(startPage: number, endPage: number) {
    return new InvokeCommand({
      FunctionName: "bestcar-dev-crawlBCarList",
      Payload: fromUtf8(
        JSON.stringify({
          startPage,
          endPage
        })
      )
    })
  }

  parseDatas<T>(...responses: InvokeCommandOutput[]) {
    return responses
      .reduce((list, response) => {
        try {
          const payload = JSON.parse(toUtf8(response.Payload!));
          return [...list, ...JSON.parse(payload.body).input];
        } catch (error) {
          console.error(error);
          // console.error(response);
          return [...list];
        }
      }, [] as T[])
  }


  async execute(pageSize: number) {
    const ranges = rangeChunk(pageSize, 5)

    const invokeCommands = ranges.map(({start, end}) =>this.createCrawlListInvokeCommands(start, end))

    const promiseResults = invokeCommands.map((invokeCommand) =>
      this.lambdaClient.send(invokeCommand)
    );
    const responses = await Promise.all(promiseResults);
    const carListObjects = this.parseDatas<CarListObject>(...responses)
    return carListObjects
  }
}

export class CarListCollector {

  constructor(
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

      await page.click('#paging > a:nth-child(1)');

      await this.carListPageWaiter.waitForSearchList(page)
    }

  async crawlCarList(startPage: number, endPage: number) {
    const { browser, page } = await this.carListPageInitializer.createInitializedBrowsers()
    try {
      const startTime = Date.now()
      const carObjects = await this.crawlRange(page, startPage, endPage)
      const endTime = Date.now()
      console.log(endTime - startTime);
      return carObjects
    } catch (error) {
      console.log(`Crawl list failed: ${error}`);
      throw error
    } finally {
      await browser.close()
    }
  }

  async batchCrawlCarListForLocal(pageSize: number) {
    const pageChunk = []
    for (let i = 1; i < pageSize; i = i+10) {
      const endPage = Math.min(i+10, pageSize)
      pageChunk.push([i, endPage])

    }
    console.log(pageChunk);

    const carListResponses = pageChunk.map(([startPage, endPage]) => this.crawlCarList(startPage, endPage))
    const carListObjectList = await Promise.all(carListResponses)
    return carListObjectList.reduce((list, chunk)=>[...list, ...chunk], [] as CarListObject[])
  }

}
