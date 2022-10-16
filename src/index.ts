import { APIGatewayEvent, Context } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda"
import { CarPageAmountCrawler, CarListPageInitializer, CarListPageWaiter, CarListCralwer, CarDetailCralwer } from './puppeteer/crawl'
import { envs } from './configs'
import { fromUtf8, toUtf8 } from "@aws-sdk/util-utf8-node"
import { writeFileSync, writeFile } from 'fs'

type CarDetailObject = {
  carInfoMap: {
    [k: string]: string
  },
  carCheckSrc: string,
  carImgList: string[]
}

// 우선 배포 함수와 배포 단계가 너무 거창해지기 때문에 이 함수 하나로 모든 프로세스를 완료하도록 할 것
// 메모리 사이즈에 대한 고려가 필요하다.
exports.manageBCar = async (
  event: APIGatewayEvent,
  context: Context
) => {
  // 0.
  const carListPageWaiter = new CarListPageWaiter()
  const carListPageInitializser = new CarListPageInitializer(
    envs, 
    carListPageWaiter
  )
  // 1. 5분 걸림
  const carPageAmountCrawler = new CarPageAmountCrawler(
    carListPageInitializser
  )
  const pageAmount = await carPageAmountCrawler.crawl()
  // 2. 여기 바로 실행
  const carListCrawlwer = new CarListCralwer(envs, carListPageInitializser, carListPageWaiter)
  const carObjects = await carListCrawlwer.crawlCarList(1, pageAmount)

  // 3. 여기에 뭔가 크롤링 되어야 할 목록을 다 구했다면, 계산을 해서 실제 크롤링 되어야 할 데이터와 아닌 데이터를 구분해야 한다.
  // db와 목록에 둘 다 있다면? -> 무시
  // db에만 있다면? -> db에서 삭제
  // db에만 없다면? -> 여기가 바로 crawl 대상 -> 이 목록만 DB에 목록으로 저장만 해두고 종료하는 방향으로 갈 수도 있다.

  // 4. crawl detail: 사실 invoke로 실행시키는건 굳이 30초 제한을 가질 필요가 없다
  // 이 경우 굉장히 chunk size를 작게해야한다.
  // 예를 들어 10페이지만 크롤링 한다고 했을 때, 30초 제한을 넘어갈 수 있다. 우선 이를 테스트 해보고 생각할 것
  // 꼭 API request 타입으로 할 필요는 없기 때문이다.

  const client = new LambdaClient({ region: envs.DYNAMO_DB_REGION });
  const promiseResults = chunk(carObjects, 10).map(chunk => {
    const command = new InvokeCommand({
      FunctionName: "bestcar-dev-crawlBCarDetail",
      Payload: fromUtf8(
        JSON.stringify(
          {
            manageNums: chunk.map(car => car.detailPageNum),
          }
        )
      )
    })
    return client.send(command)
  })
  const responses = await Promise.all(promiseResults)

  const carDetailObjects = responses.reduce((list, response) => {
    console.log(response.StatusCode);

    const payload = JSON.parse(toUtf8(response.Payload!))
    if (!payload.body) {
      console.log(payload);
    }
    return [...list, JSON.parse(payload.body).input]
    
  }, [] as CarDetailObject[])
  // writeFile('myjsonfile.json', JSON.stringify(carDetailObjects), 'utf8', ()=>{
  //   console.log("done");
  // });

  // 5. 이제 이 carDetailObjects를 저장해주어야 한다.

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: "Go Serverless v3.0! Your manageBcar function executed successfully!",
        input: event,
      },
    ),
  };
}



type BCarDetailEventInput = {
  manageNums: number[]
}

exports.crawlBCarDetail = async (
  event: BCarDetailEventInput,
  context: Context
) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      input: await new CarDetailCralwer(envs).crawlRange(event.manageNums),
    }),
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  return arr.reduce<T[][]>(
    (a, item) => {
      if (a[a.length - 1].length === size) {
        a.push([item])
      } else {
        a[a.length - 1].push(item)
      }

      return a
    },
    [[]]
  )
}