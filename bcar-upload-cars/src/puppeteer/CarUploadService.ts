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
    companyMap: Map<string, CarManufacturer>, items: Record<string, AttributeValue>[]
  ): Map<string, CarManufacturer> {

    items.reduce((map, item)=>{
      const carManufacturer = map.get(item.company.S!)
      if (!carManufacturer) {
        console.log(item.company.S!);
        throw new Error("There is no proper carModelMap")
      }
      const detailModels: CarDetailModel[] = []
      let carModelName = item.name.S!
      carModelName = carModelName === "????????????" ? "??????" : carModelName
      carModelName = carModelName === "e-?????????" ? "?????????" : carModelName
      carModelName = carModelName === "??????" ? "??????" : carModelName
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
    companyMap: Map<string, CarManufacturer>, items: Record<string, AttributeValue>[]
  ): Map<string, CarManufacturer> {

    items.reduce((map, item)=>{
      const carManufacturer = map.get(item.company.S!)
      if (!carManufacturer) {
        console.log(item.company.S!);
        throw new Error("There is no proper carModelMap")
      }

      let carModelName = item.SK.S!.replace("#MODEL-", "")
      carModelName = carModelName === "????????????" ? "??????" : carModelName
      carModelName = carModelName === "e-?????????" ? "?????????" : carModelName
      carModelName = carModelName === "??????" ? "??????" : carModelName
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
    // index ????????? detail ?????????

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

  // ?????? ???, ?????? DB??? ???????????? ?????? ????????? ??????, ????????? ????????? ?????? ????????? ????????????.
  // 10????????? ????????? ????????? ip??? ???????????????. (????????? ip????????? ????????? ????????? ????????? ?????? ????????? ??????. max browser 3~5???)
  // ????????? ????????? ????????? ??? ?????? ?????? ?????? ????????? ???????????? ????????? ????????? ????????????.
  // ??? ???????????? ?????? ?????? ????????? ?????????????????? ??????.
  async uploadCars(loginUrl: string,registerUrl: string,workerAmount: number,carAmount: number) {
    console.log("????????? ?????? ??????");
    const result = await this.dynamoCarClient.getSomeCars()  // ????????? ?????? ?????? ??????
    // let result = await this.dynamoCarClient.getAllCars(10)
    const { id: testId, pw: testPw } = await this.sheetClient.getTestAccount()
    const { segmentMap, companyMap } = await this.initializeMaps()  // ????????? ?????? ????????????

    console.log("?????? ?????? ?????? ??? ?????? ??????");
    const cars = this.formatter.createCarObject(result.items.slice(0, carAmount))
    const carClassifier = new CarClassifier(cars, segmentMap, companyMap)
    const classifiedCars = carClassifier.classifyAll()

    console.log("id ???????????? ??????");
    const rootDir = CarUploader.getImageRootDir(testId)
    try {
      await mkdir(rootDir)
    } catch {
      console.log("account directory already exist. skip mkdir");
    }

    console.log(`???????????? ????????? ????????? : ${workerAmount}`);
    await this.initializer.initializeBrowsers(workerAmount)

    console.log("?????? ?????????");
    try {
      const carUploderResult = this.initializer.pageList.map(async (page, index)=>{
        console.log(index*200, index*200 + 200);
        await this.initializer.login(page, loginUrl + registerUrl, testId, testPw)
        await this.initializer.activateEvents(page)

        return new CarUploader(
          page,
          testId,
          registerUrl,
          classifiedCars.slice(index*200, index*200 + 200),
        ).uploadCars()
      })
      await Promise.all(carUploderResult)
    } catch(e) {
      console.error(e);
    } finally {
      console.log("id ???????????? ??????");
      await rm(rootDir, { recursive: true, force: true })
    }
  }
}
