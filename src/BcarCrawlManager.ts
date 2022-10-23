import { fromUtf8, toUtf8 } from "@aws-sdk/util-utf8-node";
import { LambdaClient, InvokeCommand, InvokeCommandOutput } from "@aws-sdk/client-lambda";
import { PutRequest } from "@aws-sdk/client-dynamodb";

import { DynamoClient } from "./db/dynamo/DynamoClient";
import { CarListCralwer, CarPageAmountCrawler } from "./puppeteer";
import {
  CarListObject,
  CarInfoMap,
  // CarDetailObject,
  DBCarListObject,
  batchPutCarsInput
} from "./types"
import { chunk, rangeChunk } from "./utils"

export type CarDetailObject = {
  carInfoMap: CarInfoMap;
  carCheckSrc: string;
  carImgList: string[]| null;
};

export class BcarCrawlManager {
  constructor(
    private carPageAmountCrawler: CarPageAmountCrawler,
    private lambdaClient: LambdaClient,
    private dynamoClient: DynamoClient,
  ) {
  }

  filterCrawlDetails(carObjects:CarListObject[], carListInDatabase: DBCarListObject) {

    const itemMap = carListInDatabase.items.reduce((map, item) => {
      return map.set(item.CarNumber.S!, true)
    }, new Map<string, boolean>())
    console.log("itemMap.size");
    console.log(itemMap.size);

    const crawledCarListMap = carObjects.reduce((map, carObj) => {
      return map.set(carObj.carNum, carObj)
    }, new Map<string, CarListObject>())
    console.log("crawledCarListMap.size");
    console.log(crawledCarListMap.size);

    Array.from(itemMap.entries()).forEach(([carNum, exist])=>{
      if (exist && crawledCarListMap.get(carNum)) {
        itemMap.delete(carNum)
        crawledCarListMap.delete(carNum)
      }
    })
    return {
      carsShouldDelete: Array.from(itemMap.keys()),
      carsShouldCrawl: Array.from(crawledCarListMap.values()),
    }
  }

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

  async crawlDetailDatas(carsShouldCrawl: CarListObject[]) {
    const invokeCommands = this.createCrawlDetailInvokeCommands(carsShouldCrawl, 5);
    const promiseResults = invokeCommands.map((invokeCommand) =>
      this.lambdaClient.send(invokeCommand)
    )

    const responses = await Promise.all(promiseResults);
    return responses

    // // 람다에서 제대로된 리턴과 상태코드를 보내도록 해야되는것이 첫번째, 실패시 body를 없애거나 적절한 형식으로 리턴해주는게 두번째
    // if (payload.body === '{}') {
    //   // console.log("response");
    //   // console.log(response);
    //   // console.log("payload");
    //   // console.log(JSON.parse(toUtf8(invokeCommand.input.Payload!)))
    //   // console.log(payload);
    //   throw new ResponseError("crawlDetailWithJitter: body is empty")
    // }
  }

  async crawlCarListDatas(pageSize: number, chunkSize: number) {
    const ranges = rangeChunk(pageSize, chunkSize)
    console.log(ranges);

    const invokeCommands = ranges.map(({start, end}) =>this.createCrawlListInvokeCommands(start, end))

    const promiseResults = invokeCommands.map((invokeCommand) =>
      this.lambdaClient.send(invokeCommand)
    );
    const responses = await Promise.all(promiseResults);
    return responses
  }

  createPutRequestInput(car: CarDetailObject, price: number) {
    const input: batchPutCarsInput = {
      PK: { S: `#CAR-${car.carInfoMap.CarNumber}` },
      SK: { S: `#CAR-${car.carInfoMap.CarNumber}` },
      Category: { S: car.carInfoMap.Category },
      Displacement: { S: car.carInfoMap.Displacement },
      CarNumber: { S: car.carInfoMap.CarNumber },
      ModelYear: { S: car.carInfoMap.ModelYear },
      Mileage: { S: car.carInfoMap.Mileage },
      Color: { S: car.carInfoMap.Color },
      Price: { N: price.toString() },
      GearBox: { S: car.carInfoMap.GearBox },
      FuelType: { S: car.carInfoMap.FuelType },
      PresentationNumber: { S: car.carInfoMap.PresentationNumber },
      HasAccident: { S: car.carInfoMap.HasAccident },
      RegisterNumber: { S: car.carInfoMap.RegisterNumber },
      PresentationsDate: { S: car.carInfoMap.PresentationsDate },
      HasSeizure: { BOOL: car.carInfoMap.HasSeizure }, // 압류
      HasMortgage: { BOOL: car.carInfoMap.HasMortgage }, // 저당
      CarCheckSrc: { S: car.carCheckSrc },
    }
    if (car.carImgList) {
      input.CarImgList = { SS: car.carImgList! }
    }
    return {
      Item: input
    }
  }

  async saveDatas(carDetailObjects: CarDetailObject[],  crawledCarListMap: Map<string, CarListObject>) {
    const PutRequestObjects: PutRequest[] = carDetailObjects.map((car) => {
      return this.createPutRequestInput(car, crawledCarListMap.get(car.carInfoMap.CarNumber)!.price);
    });

    return await this.dynamoClient.batchPutCars(...PutRequestObjects)
  }

  parseDatas<T>(responses: InvokeCommandOutput[]) {
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

  async execute() {
    const carListInDatabase = await this.dynamoClient.getAllCarNumber(10)
    console.log("carListInDatabase.count");
    console.log(carListInDatabase.count);

    const pageAmount = await this.carPageAmountCrawler.crawl();
    console.log(pageAmount);

    const crawlListResponses = await this.crawlCarListDatas(pageAmount, 5)
    const carListObjects = this.parseDatas<CarListObject>(crawlListResponses)
    console.log("carListObjects.length");
    console.log(carListObjects.length);
    // const r = carListObjects.reduce((map, input)=>{
    //   let count = map.get(input.carNum)
    //   if (!count) {
    //     count = 0
    //   }
    //   return map.set(input.carNum, count + 1)
    // }, new Map<string, number>())
    // Array.from(r.entries()).forEach(([carNum, count])=> {
    //   if (count > 1) {
    //     console.log(`${carNum} ${count}`);
    //   }
    // })
    // const carListObjects = await this.carListCrawlwer.crawlCarList(1, pageAmount)

    const { carsShouldDelete, carsShouldCrawl } = this.filterCrawlDetails(carListObjects, carListInDatabase);

    console.log("carsShouldDelete");
    console.log(carsShouldDelete);
    console.log("carsShouldCrawl");
    console.log(carsShouldCrawl);

    if (!carsShouldCrawl.length) {
      console.log("there is no cars to crawl. end the execution");
      return
    }
    // Detail 조회 람다 호출 구간
    const crawlDetailResponses = await this.crawlDetailDatas(carsShouldCrawl);
    const carDetailObjects = this.parseDatas<CarDetailObject>(crawlDetailResponses);

    const crawledCarListMap = carListObjects.reduce((map, carObj) => {
      return map.set(carObj.carNum, carObj)
    }, new Map<string, CarListObject>())

    // 저장 로직: 차량 가격도 저장되어야 한다. 업데이트 로직이 필요할 것
    const saveResponses = await this.saveDatas(carDetailObjects, crawledCarListMap);
    console.log(saveResponses)

    // 삭제 로직
    const deleteresponses = await this.dynamoClient.batchDeleteCar(carsShouldDelete)

  }

  async updatePrices() {
    const carListInDatabase = await this.dynamoClient.getAllCars(10)
    const pageAmount = await this.carPageAmountCrawler.crawl();
    const crawlListResponses = await this.crawlCarListDatas(pageAmount, 5)
    const carListObjects = this.parseDatas<CarListObject>(crawlListResponses)
    const crawledCarListMap = carListObjects.reduce((map, carObj) => {
      return map.set(carObj.carNum, carObj)
    }, new Map<string, CarListObject>())

    const putRequests = carListInDatabase.items.reduce((list, item) => {
      const newPrice = crawledCarListMap.get(item.CarNumber.S!)!.price.toString()
      if (item.Price && item.Price.N && item.Price.N == newPrice) {
        return list
      }
      item.Price = { N : newPrice }
      list.push({Item: item})
      return list
    }, [] as PutRequest[])

    if (!putRequests.length) {
      console.log("there is no need to update");
      return
    }

    const results =  await this.dynamoClient.batchPutCars(...putRequests)
    console.log(results);

  }

}

