import { LambdaClient, InvokeCommand, InvokeCommandOutput } from "@aws-sdk/client-lambda";
import { fromUtf8, toUtf8 } from "@aws-sdk/util-utf8-node";
import { CarInfoMap, CarListObject } from "../types"
import { chunk } from "../utils"


export type CarDetailObject = {
  carInfoMap: CarInfoMap;
  carCheckSrc: string;
  carImgList: string[]| null;
};

export class CarDetailCollectorLambda {

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

  createCrawlDetailInvokeCommands(carObjects: CarListObject[], chunkSize: number) {
    const carManageNumbers = carObjects.map(car =>car.detailPageNum)
    const carManageNumbersChunk = chunk(carManageNumbers, chunkSize)

    return carManageNumbersChunk.map((carManageNumbers) => (
      new InvokeCommand({
        FunctionName: "bestcar-dev-crawlBCarDetail",
        Payload: fromUtf8(
          JSON.stringify({
            manageNums: carManageNumbers
          })
        )
      })
    ))
  }

  async execute(carsShouldCrawl: CarListObject[]) {

    const invokeCommands = this.createCrawlDetailInvokeCommands(carsShouldCrawl, 5);
    const promiseResults = invokeCommands.map((invokeCommand) =>
      this.lambdaClient.send(invokeCommand)
    )

    const responses = await Promise.all(promiseResults);
    const carListObjects = this.parseDatas<CarDetailObject>(...responses)
    return carListObjects
  }
}
