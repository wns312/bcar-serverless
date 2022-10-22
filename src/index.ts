import { APIGatewayEvent, Context } from "aws-lambda";
import { LambdaClient } from "@aws-sdk/client-lambda";

import { BcarCrawlManager } from "./BcarCrawlManager"
import { envs } from './configs'
import { DynamoClient } from "./db/dynamo/DynamoClient";
import {
  CarPageAmountCrawler,
  CarListPageInitializer,
  CarListPageWaiter,
  CarListCralwer,
  CarDetailCralwer
} from "./puppeteer";
import { BCarDetailEventInput, BCarListEventInput } from "./types"

// 우선 배포 함수와 배포 단계가 너무 거창해지기 때문에 이 함수 하나로 모든 프로세스를 완료하도록 할 것
// 메모리 사이즈에 대한 고려가 필요하다.
exports.manageBCar = async (
  event: APIGatewayEvent,
  context: Context
) => {
  const { DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX } = envs
  const carListPageWaiter = new CarListPageWaiter();
  const carListPageInitializer = new CarListPageInitializer(envs, carListPageWaiter)

  const carPageAmountCrawler = new CarPageAmountCrawler(carListPageInitializer)

  const lambdaClient = new LambdaClient({ region: DYNAMO_DB_REGION });
  const dynamoClient = new DynamoClient(DYNAMO_DB_REGION, BCAR_TABLE, BCAR_INDEX)

  await new BcarCrawlManager(
    carPageAmountCrawler,
    lambdaClient,
    dynamoClient,
  ).execute()

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

exports.crawlBCarList = async (
  event: BCarListEventInput,
  context: Context
) => {
  const carListPageWaiter = new CarListPageWaiter();
  const carListPageInitializer = new CarListPageInitializer(envs, carListPageWaiter)
  const carListCrawlwer = new CarListCralwer(
    carListPageInitializer,
    carListPageWaiter
  )
  try {
    const result = await carListCrawlwer.crawlCarList(
      event.startPage,
      event.endPage,
    )
    return {
      statusCode: 200,
      body: JSON.stringify({
        input: result,
        startPage: event.startPage,
        endPage: event.endPage,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `${error}`,
      }),
    };
  }


}


exports.crawlBCarDetail = async (
  event: BCarDetailEventInput,
  context: Context
) => {

  try {
    const carDetails = await new CarDetailCralwer(envs).crawlRange(event.manageNums)
    return {
      statusCode: 200,
      body: JSON.stringify({
        input: carDetails,
        manageNums: event.manageNums
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: `${error}`,
      }),
    };
  }

}

