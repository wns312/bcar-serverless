import { fromUtf8, toUtf8 } from "@aws-sdk/util-utf8-node";
import { DynamoClient } from "./db/dynamo/DynamoClient";
import {
  LambdaClient,
  InvokeCommand,
  InvokeCommandOutput,
} from "@aws-sdk/client-lambda";
import {
  BatchWriteItemCommandOutput,
  PutRequest,
  DeleteRequest,
  AttributeValue,
} from "@aws-sdk/client-dynamodb";
import {
  CarPageAmountCrawler,
  CarListPageInitializer,
  CarListPageWaiter,
  CarListCralwer,
} from "./puppeteer/crawl";
import { envs } from "./configs";
import { ResponseError } from "./errors"

type CarListObject = {
  carNum: string;
  detailPageNum: number;
  price: number;
};

type CarInfoMap = {
  Category: string;
  Displacement: string;
  CarNumber: string;
  ModelYear: string;
  Mileage: string;
  Color: string;
  GearBox: string;
  FuelType: string;
  PresentationNumber: string;
  HasAccident: string;
  RegisterNumber: string;
  PresentationsDate: string;
  HasSeizure: boolean;
  HasMortgage: boolean;
};

type CarDetailObject = {
  carInfoMap: CarInfoMap;
  carCheckSrc: string;
  carImgList: string[]| null;
};

type BatchCreateCarInput = {
  PK: AttributeValue
  SK: AttributeValue
  Category: AttributeValue
  Displacement: AttributeValue
  CarNumber: AttributeValue
  ModelYear: AttributeValue
  Mileage: AttributeValue
  Color: AttributeValue
  GearBox: AttributeValue
  FuelType: AttributeValue
  PresentationNumber: AttributeValue
  HasAccident: AttributeValue
  RegisterNumber: AttributeValue
  PresentationsDate: AttributeValue
  HasSeizure: AttributeValue
  HasMortgage: AttributeValue
  CarCheckSrc: AttributeValue
  CarImgList?: AttributeValue
};

export class BcarCrawlManager {
  carListPageWaiter: CarListPageWaiter;
  carListPageInitializser: CarListPageInitializer;
  carPageAmountCrawler: CarPageAmountCrawler;
  carListCrawlwer: CarListCralwer;
  lambdaClient: LambdaClient;
  dynamoClient: DynamoClient;

  constructor() {
    this.carListPageWaiter = new CarListPageWaiter();
    this.carListPageInitializser = new CarListPageInitializer(
      envs,
      this.carListPageWaiter
    );
    this.carPageAmountCrawler = new CarPageAmountCrawler(
      this.carListPageInitializser
    );
    this.carListCrawlwer = new CarListCralwer(
      envs,
      this.carListPageInitializser,
      this.carListPageWaiter
    );
    this.lambdaClient = new LambdaClient({ region: envs.DYNAMO_DB_REGION });

    this.dynamoClient = new DynamoClient(
      envs.DYNAMO_DB_REGION,
      envs.BCAR_TABLE,
      envs.BCAR_INDEX
    );
  }

  async filterCrawlDetails(carObjects:CarListObject[], carListInDatabase: {items: Record<string, AttributeValue>[], count: number}) {

    const itemMap = carListInDatabase.items.reduce((map, item) => {
      return map.set(item.CarNumber.S!, true)
    }, new Map<string, boolean>())

    const crawledCarListMap = carObjects.reduce((map, carObj) => {
      return map.set(carObj.carNum, carObj)
    }, new Map<string, CarListObject>())

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
  createInvokeCommands(carObjects: CarListObject[]) {
    const carObjectsChunk = chunk(carObjects, 5);

    return carObjectsChunk.map((carObjectsChunk) => {
      const detailPageNumbers = carObjectsChunk.map((car) => car.detailPageNum);
      return new InvokeCommand({
        FunctionName: "bestcar-dev-crawlBCarDetail",
        Payload: fromUtf8(
          JSON.stringify({
            manageNums: detailPageNumbers,
          })
        ),
      });
    });
  }

  // 람다 요청을 jitter로 할 필요 없다.
  async crawlDetailWithJitter(invokeCommand: InvokeCommand, jitter: number = 1) {
    if (jitter > 8) {
      throw new ResponseError("crawl detail lambda failed")
    }
    let response = await this.lambdaClient.send(invokeCommand)
    const payload = JSON.parse(toUtf8(response.Payload!));

    // 람다에서 제대로된 리턴과 상태코드를 보내도록 해야되는것이 첫번째, 실패시 body를 없애거나 적절한 형식으로 리턴해주는게 두번째
    if (payload.body === '{}') {
      console.log("response");
      console.log(response);
      console.log("payload");
      console.log(JSON.parse(toUtf8(invokeCommand.input.Payload!)))
      console.log(payload);
    }
    if (!payload.body) {
      setTimeout(async()=>{
        response = await this.crawlDetailWithJitter(invokeCommand, jitter * 2)
      }, jitter * 1000)
    }
    return response
  }
  // 지터처리 고민좀 해보기 : 우선 단일 요청을 처리하는 함수로 한번 더 쪼개야 한다.
  async crawlDetailDatas(invokeCommands: InvokeCommand[]) {
    const promiseResults = invokeCommands.map((invokeCommand) =>
      this.crawlDetailWithJitter(invokeCommand)
    );
    const responses = await Promise.all(promiseResults);
    return responses;

  }

  createPutRequestInput(car: CarDetailObject) {
    const input: BatchCreateCarInput = {
      PK: { S: `#CAR-${car.carInfoMap.CarNumber}` },
      SK: { S: `#CAR-${car.carInfoMap.CarNumber}` },
      Category: { S: car.carInfoMap.Category },
      Displacement: { S: car.carInfoMap.Displacement },
      CarNumber: { S: car.carInfoMap.CarNumber },
      ModelYear: { S: car.carInfoMap.ModelYear },
      Mileage: { S: car.carInfoMap.Mileage },
      Color: { S: car.carInfoMap.Color },
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

  async saveDatas(carDetailObjects: CarDetailObject[]) {
    // db input에 맞는 객체 생성
    const PutRequestObjects: PutRequest[] = carDetailObjects.map((car) => {
      return this.createPutRequestInput(car);
    });
    // 최대 25개만 한번에 저장이 가능하므로 chunk로 25단위로 나눈다
    const putRequestsChunks = chunk(PutRequestObjects, 25);
    // map을 사용해서 순차저장하고 결과를 담아 리턴한다.
    const results = await Promise.all(
      putRequestsChunks.map(async (putRequests) => {
        return await this.dynamoClient.batchCreateCar(...putRequests);
      })
    );
    return results;
  }

  async parseDatas(responses: InvokeCommandOutput[]) {
    return responses
      .reduce((list, response) => {
        try {
          const payload = JSON.parse(toUtf8(response.Payload!));
          return [...list, ...JSON.parse(payload.body).input];
        } catch (error) {
          console.error(error);
          console.error(response);
          return [...list];
        }
      }, [] as CarDetailObject[])
      .map(car=>{
        if (car.carImgList) {
          car.carImgList = car.carImgList.filter(img => !img.startsWith('/images/nophoto') )
          car.carImgList = car.carImgList.length ? car.carImgList : null
        }

        return car
      });
  }

  async execute() {
    const carListInDatabase = await this.dynamoClient.getAllCarNumber(10)
    console.log(carListInDatabase.count);
    return
    let pageAmount = await this.carPageAmountCrawler.crawl();
    // const carListObjects = await this.carListCrawlwer.batCrawlCarListForLocal(40)
    const carListObjects = await this.carListCrawlwer.crawlCarList(1, pageAmount)

    // Detail 크롤링 여부 필터링 구간.
    // 추후에 업데이트 관련 부분이 추가될 수 있음. 이 경우 detail 정보를 전부 긁어와야 하기 때문에 실현 가능성은 낮다.
    const { carsShouldDelete, carsShouldCrawl } = await this.filterCrawlDetails(carListObjects, carListInDatabase);
    console.log(carsShouldDelete);
    console.log(carsShouldDelete.length);

    console.log(carsShouldCrawl);
    // 크롤링 할 데이터가 없는경우 람다 실행을 하지 않고 리턴되는 구간. 이 구간때문에 삭제 로직이 수행되지 않을 수 있으므로 처리 필요.
    if (!carsShouldCrawl.length) {
      console.log("there is no cars to crawl. end the execution");
      return
    }
    // Detail 조회 람다 호출 구간
    const invokeCommands = this.createInvokeCommands(carsShouldCrawl);
    const responses = await this.crawlDetailDatas(invokeCommands);
    const carDetailObjects = await this.parseDatas(responses);

    console.log(carDetailObjects.map((car)=>car.carImgList));

    // 저장 로직 여기
    const results = await this.saveDatas(carDetailObjects);
    console.log("Result!!!!!s");

    console.log(
      results
        .map((result) => {
          if (result.$metadata.httpStatusCode !== 200) {
            return result;
          }
          return null;
        })
        .filter((result): result is BatchWriteItemCommandOutput =>
          Boolean(result)
        )
    );

    // 삭제 로직 여기
    const carsShouldDeleteChunk = chunk(carsShouldDelete, 25);
    const promiseResultChunk = carsShouldDeleteChunk.map(async chunk => {
      return await this.dynamoClient.batchDeleteCar(...chunk.map(car => {
        return {
          Key: {
            PK: { S: `#CAR-${car}`},
            SK: { S: `#CAR-${car}`},
          }
        }
      }))
    })
    const deleteResults = await Promise.all(promiseResultChunk)
    console.log(deleteResults);

  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  return arr.reduce<T[][]>(
    (a, item) => {
      if (a[a.length - 1].length === size) {
        a.push([item]);
      } else {
        a[a.length - 1].push(item);
      }

      return a;
    },
    [[]]
  );
}
