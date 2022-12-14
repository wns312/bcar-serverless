import {
  CarDataObject,
  CarManufacturer,
  CarSegment,
  ManufacturerOrigin,
  UploadSource,
} from "../types"
import { categoryConvertor, companyConvertor, modelDetailConverter } from "../utils"

export class CarClassifier {
  constructor(
    private cars: CarDataObject[],
    private segmentMap: Map<string, CarSegment>,
    private companyMap: Map<string, CarManufacturer>,
  ) {}

  private classify(car: CarDataObject) {
    const convertedCategory = categoryConvertor.get(car.category)!
    const convertedCompany = companyConvertor.get(car.company)!
    const { name: companyName, origin: companyOrigin } = convertedCompany
    const carSegment = this.segmentMap.get(convertedCategory)
    const carCompany = this.companyMap.get(companyName)

    if (!carSegment || !carCompany) {
      console.error({
        car,
        convertedCategory,
        convertedCompany,
        carSegment,
        carCompany,
        // companyMap: this.companyMap
      });
      throw new Error("Segment or Company does not exist");
    }
    carSegment!.index


    // result.push(car.title)
    const uploadSource: UploadSource = {
      car,
      origin: convertedCompany!.origin,
      carSegment: {
        name: carSegment!.name,
        dataValue: carSegment!.value,
        index: carSegment!.index,
      },
      carCompany: {
        name: carCompany.name,
        dataValue: carCompany.dataValue,
        index: carCompany.index,
      },
    }

    if (companyOrigin === ManufacturerOrigin.Imported) {
      return uploadSource
    }
    const modelKeys = Array.from(carCompany.carModelMap.keys())
    const matchedModelKeys = modelKeys.filter(key=>car.title.indexOf(key) !== -1)
    if (!matchedModelKeys.length) {
      return uploadSource
    }
    const carModelName = matchedModelKeys[0]
    const carModel = carCompany.carModelMap.get(carModelName)
    if (!carModel) {
      console.log(carModel);
      throw new Error("carModel does not exist")
    }
    uploadSource.carModel = {
      name: carModel.name,
      dataValue: carModel.dataValue,
      index: carModel.index,
    }

    if (!carModel.detailModels || !carModel.detailModels.length) {
      return uploadSource
    }

    const filteredDetails = carModel.detailModels.filter(detail=> {
      const convertedDetailName = modelDetailConverter.get(detail.name)
      const detailName = convertedDetailName ? convertedDetailName : detail.name
      return car.title.replaceAll(" ", "").indexOf(detailName) !== -1
    })
    if (!filteredDetails.length) {
      console.log([filteredDetails, car.title]);
      return uploadSource
    }
    uploadSource.carDetailModel = {
      name: filteredDetails[0].name,
      dataValue: filteredDetails[0].dataValue,
      index: filteredDetails[0].index,
    }

    return uploadSource
  }

  classifyAll() {
    return this.cars.map(car => this.classify(car))
  }
}
