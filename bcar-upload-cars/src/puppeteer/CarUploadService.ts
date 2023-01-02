import { mkdir, rm } from "fs/promises"
import { AttributeValue } from "@aws-sdk/client-dynamodb"
import { BrowserInitializer, CarClassifier, CarUploader } from "."
import { DynamoClient, DynamoCategoryClient } from "../db/dynamo"
import { AccountSheetClient } from "../sheet"
import { CarDetailModel, CarModel, CarSegment, CarManufacturer, ManufacturerOrigin } from "../types"
import { CarObjectFormatter } from "../utils"

export class CarUploadService {
  constructor(
    private sheetClient: AccountSheetClient,
    private dynamoCarClient: DynamoClient,
    private dynamoCategoryClient: DynamoCategoryClient,
    private formatter: CarObjectFormatter,
    private initializer: BrowserInitializer,
  ) {}

  private createSegmentMap(items: Record<string, AttributeValue>[]): Map<string, CarSegment> {
    const segmentMap = new Map<string, CarSegment>()
    items.reduce((map, item)=>{
      return map.set(item.name.S!, {
        name: item.name.S!,
        value: item.value.S!,
        index: Number.parseInt(item.index.N!),
      })
    }, segmentMap)
    return segmentMap
  }

  private createCompanyMap(items: Record<string, AttributeValue>[]): Map<string, CarManufacturer> {
    const manufacturerMap = new Map<string, CarManufacturer>()
    items.reduce((map, item)=>{
      return map.set(item.name.S!, {
        origin: item.origin.S! === "DOMESTIC" ? ManufacturerOrigin.Domestic : ManufacturerOrigin.Imported,
        name: item.name.S!,
        dataValue: item.value.S!,
        index: Number.parseInt(item.index.N!),
        carModelMap: new Map<string, CarModel>()
      })
    }, manufacturerMap)
    return manufacturerMap
  }

  private fillCarModelMap(
    companyMap: Map<string, CarManufacturer>,
    items: Record<string, AttributeValue>[]
  ): Map<string, CarManufacturer> {



    items.reduce((map, item)=>{
      const carManufacturer = map.get(item.company.S!)
      if (!carManufacturer) {
        console.log(item.company.S!);
        throw new Error("There is no proper carModelMap")
      }
      const detailModels: CarDetailModel[] = []
      let carModelName = item.name.S!
      carModelName = carModelName === "봉고화물" ? "봉고" : carModelName
      carModelName = carModelName === "e-마이티" ? "마이티" : carModelName
      carModelName = carModelName === "캡처" ? "캡쳐" : carModelName
      carManufacturer.carModelMap.set(carModelName, {
        carSegment: item.segment.S!,
        name: item.name.S!,
        dataValue: item.value.S!,
        index: Number.parseInt(item.index.N!),
        detailModels
      })
      return map
    }, companyMap)
    return companyMap
  }

  private fillCarDetails(
    companyMap: Map<string, CarManufacturer>,
    items: Record<string, AttributeValue>[]
  ): Map<string, CarManufacturer> {


    const detailModels: CarDetailModel[] = []
    items.reduce((map, item)=>{
      const carManufacturer = map.get(item.company.S!)
      if (!carManufacturer) {
        console.log(item.company.S!);
        throw new Error("There is no proper carModelMap")
      }

      let carModelName = item.SK.S!.replace("#MODEL-", "")
      carModelName = carModelName === "봉고화물" ? "봉고" : carModelName
      carModelName = carModelName === "e-마이티" ? "마이티" : carModelName
      carModelName = carModelName === "캡처" ? "캡쳐" : carModelName
      const carModel = carManufacturer.carModelMap.get(carModelName)
      if (!carModel) {
        console.log(carModelName);
        throw new Error("There is no proper carModel")
      }

      carModel.detailModels!.push({
        name: item.name.S!,
        dataValue: item.value.S!,
        index: Number.parseInt(item.index.N!),
      })
      return map
    }, companyMap)
    // index 순서로 detail 재정렬

    companyMap.forEach(company=>{
      company.carModelMap.forEach(model=>{
        model.detailModels = model.detailModels!.sort((a, b)=>{
          return a.index - b.index
        })
      })
    })
    return companyMap
  }

  private async initializeMaps() {
    const segmentResult = await this.dynamoCategoryClient.getAllCarSegments()
    const segmentMap = this.createSegmentMap(segmentResult.items)
    const companyResult = await this.dynamoCategoryClient.getAllCarCompanies()
    const companyMap = this.createCompanyMap(companyResult.items)

    const carModelResult = await this.dynamoCategoryClient.getAllCarModels()
    await this.fillCarModelMap(companyMap, carModelResult.items)

    const carDetailResult = await this.dynamoCategoryClient.getAllCarDetails(2)
    this.fillCarDetails(companyMap, carDetailResult.items)
    return {
      segmentMap,
      companyMap
    }
  }

  async uploadCars(
    loginUrl: string,
    registerUrl: string,
    workerAmount: number,
    carAmount: number,
  ) {
    console.log("차량 DB 조회 시작"); // 여기가 되게 오래 걸림
    const result = await this.dynamoCarClient.getSomeCars()
    // let result = await this.dynamoCarClient.getAllCars(10)
    result.count = carAmount
    result.items = result.items.slice(0, carAmount)
    console.log("차량 객체 생성 시작");
    const cars = this.formatter.createCarObject(result.items)

    console.log("스프레드 시트 조회 시작");
    const { id: testId, pw: testPw } = await this.sheetClient.getTestAccount()

    console.log("카테고리용 map DB 조회 및 생성 시작"); // 여기도 약간 오래걸림
    const { segmentMap, companyMap } = await this.initializeMaps()

    console.log("차량 분류 시작");
    const carClassifier = new CarClassifier(cars, segmentMap, companyMap)
    const classifiedCars = carClassifier.classifyAll()

    console.log("차량 업로드 시작");
    // 여기서 이제 객체를 여러개 만들어서 id별로 업로드 하면 된다.
    // 작업 전, 후로 DB를 조회해서 이미 등록된 차량, 마감된 차량에 대한 처리를 해야한다.
    const carUploders: Promise<void>[] = []

    // 10개까지 사용한 경우에 ip가 차단되었음.
    // 5개까지는 괜찮았던것 같은데 테스트가 필요함
    // 하나의 ip에서의 과도한 트래픽 발생이 가장 중요한 원인이다.
    // 따라서
    // 1. 과도하지 않은 트래픽만 발생해야 한다. (실행 중간에 끊기면 안되기 때문)
    // 2. 로컬테스트에서는 과도한 worker를 사용해야 한다
    // 3. 결국 하나의 batch에서 3~5개의 worker만 사용하는 것이 바람직하다.
    // id 자체가 중요한 것은 아님. ip당 트래픽이 가장 중요함
    const url = loginUrl + registerUrl
    await this.initializer.initializeBrowsers(workerAmount)

    const pagesPromise = this.initializer.browserList.map(async browser=>{
      const pages = await browser.pages()
      const page = pages[0]
      page.on("dialog", async (dialog)=>{
        await dialog.accept()
        console.log("실행 완료");
        throw Error("Cannot register cars anymore")
      })
      // 차량을 더이상 등록할 수 없는 경우 이벤트 리스너를 통해서 실행을 종료한다.
      // 이 경우에도 차량 등록 내용을 갱신해주어야 한다.
      await this.initializer.login(page, url, testId, testPw)
      return page
    })
    const pages = await Promise.all(pagesPromise)

    console.log(`pages initialize done : ${workerAmount}`);


    const rootDir = CarUploader.getImageRootDir(testId)

    try {
      await mkdir(rootDir)
    } catch {
      console.log("account directory already exist. skip mkdir");
    }

    try {
      for (let i = 0; i < workerAmount; i++) {
        const carUploader = new CarUploader(
          testId,
          registerUrl,
          classifiedCars.slice(i*200, i*200 + 200),
        )
        console.log(i*200, i*200 + 200);

        carUploders.push(carUploader.uploadCars(pages[i]))
      }
      await Promise.all(carUploders)
    } catch(e) {
      console.error(e);
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  }
}
