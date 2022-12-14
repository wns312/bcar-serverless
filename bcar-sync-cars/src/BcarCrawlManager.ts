
import { PutRequest } from "@aws-sdk/client-dynamodb";

import { DynamoClient } from "./db/dynamo/DynamoClient";
import { CarDetailCollectorLambda, CarDetailObject, CarListCollector, CarListCollectorLambda, CarPageAmountCrawler } from "./puppeteer";
import {
  CarListObject,
  DBCarListObject,
  batchPutCarsInput
} from "./types"



export class BcarCrawlManager {
  constructor(
    private carPageAmountCollector: CarPageAmountCrawler,
    private carListCollector: CarListCollector,
    private carDetailCollector: CarDetailCollectorLambda,
    private dynamoClient: DynamoClient,
  ) {
  }

  filterCrawlDetails(carObjects:CarListObject[], carListInDatabase: DBCarListObject) {
    console.log("filterCrawlDetails");

    const itemMap = carListInDatabase.items.reduce((map, item) => {
      if (!item.CarNumber) {
        console.warn(item);
        return map
      }

      return map.set(item.CarNumber.S!, true)
    }, new Map<string, boolean>())

    const crawledCarListMap = carObjects.reduce((map, carObj) => {
      return map.set(carObj.carNum, carObj)
    }, new Map<string, CarListObject>())

    console.log("itemMap.size");
    console.log(itemMap.size);
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

  createPutRequestInput(car: CarDetailObject, title: string, company: string, price: number) {
    const input: batchPutCarsInput = {
      PK: { S: `#CAR-${car.carInfoMap.CarNumber}` },
      SK: { S: `#CAR-${car.carInfoMap.CarNumber}` },
      Category: { S: car.carInfoMap.Category },
      Displacement: { S: car.carInfoMap.Displacement },
      Title: { S: title },
      Company: { S: company },
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
      return this.createPutRequestInput(
        car,
        crawledCarListMap.get(car.carInfoMap.CarNumber)!.title,
        crawledCarListMap.get(car.carInfoMap.CarNumber)!.company,
        crawledCarListMap.get(car.carInfoMap.CarNumber)!.price,
        );
    });

    return await this.dynamoClient.batchPutCars(...PutRequestObjects)
  }


  private async updatePrices(crawledCarListMap: Map<string, CarListObject>) {
    console.log("Update price start");
    const carListInDatabase = await this.dynamoClient.getAllCars(10)
    const putRequests = carListInDatabase.items.reduce((list, item) => {
      try {
        // 여기 에러 있음
        const newPrice = crawledCarListMap.get(item.CarNumber.S!)!.price.toString()
        if (item.Price && item.Price.N && item.Price.N == newPrice) {
          return list
        }

        item.Price = { N : newPrice }
        list.push({Item: item})
        return list
      } catch (error) {
        if (error instanceof Error) {
          console.error(error.name);
          console.error(error.message);
          console.error(error.stack);
        }

        return list
      }

    }, [] as PutRequest[])

    if (!putRequests.length) {
      console.log("there is nothing to update. end the execution");
      return
    }

    const results =  await this.dynamoClient.batchPutCars(...putRequests)
    console.log(results);

  }

  async execute() {
    const carListInDatabase = await this.dynamoClient.getAllCarNumber(10)
    console.log("carListInDatabase.count");
    console.log(carListInDatabase.count);
    const pageAmount = await this.carPageAmountCollector.crawl();
    console.log(pageAmount);

    const carListObjects = await this.carListCollector.crawlCarList(1, pageAmount)
    console.log("carListObjects.length");
    console.log(carListObjects.length);

    const { carsShouldDelete, carsShouldCrawl } = this.filterCrawlDetails(carListObjects, carListInDatabase);

    console.log("carsShouldDelete");
    console.log(carsShouldDelete);
    console.log("carsShouldCrawl");
    console.log(carsShouldCrawl);

    const crawledCarListMap = carListObjects.reduce((map, carObj) => {
      return map.set(carObj.carNum, carObj)
    }, new Map<string, CarListObject>())

    if (carsShouldCrawl.length) {
      for (let i = 0; i < carsShouldCrawl.length; i = i + 1000) {
        console.log(`i = ${i} start (total ${carsShouldCrawl.length})`);

      // Detail 조회 람다 호출 구간
      const carDetailObjects = await this.carDetailCollector.execute(
        carsShouldCrawl.slice(i, i + 1000)
      )

      const saveResponses = await this.saveDatas(carDetailObjects, crawledCarListMap);
      console.log(saveResponses)
      console.log(`i = ${i} end (total ${carsShouldCrawl.length})`);
      }
    }

    // 삭제에 대한 검증을 추가할 것 (detail 페이지는 항상 존재하므로 검색 count가 0인지 확인하는 방식으로 진행할 것)
    if (carsShouldDelete.length) {
      const deleteresponses = await this.dynamoClient.batchDeleteCar(carsShouldDelete)
      console.log("Delete response :");
      console.log(deleteresponses);
    }

    this.updatePrices(crawledCarListMap)

  }
}
