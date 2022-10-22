import { APIGatewayEvent, Context } from "aws-lambda";

import { CarDetailCralwer } from './puppeteer/crawl'
import { envs } from './configs'

import { BcarCrawlManager } from "./BcarCrawlManager"


// 우선 배포 함수와 배포 단계가 너무 거창해지기 때문에 이 함수 하나로 모든 프로세스를 완료하도록 할 것
// 메모리 사이즈에 대한 고려가 필요하다.
exports.manageBCar = async (
  event: APIGatewayEvent,
  context: Context
) => {
  await new BcarCrawlManager().execute()

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

