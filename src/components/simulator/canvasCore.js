import React, { Component } from 'react'
import PropTypes from 'prop-types'
import * as PubSub from 'pubsub-js'

import { colour } from '../../styles/theme'

const accessType = {
  read: 0,
  write: 1,
  execute: 2
}

class CanvasCore extends Component {

  constructor(props) {

    super(props)

    this.getCoreInstructions = props.getCoreInstructions
    this.reset = props.init
    this.republish = props.republish

    this.messages = []
    this.lastCoordinates = null
    this.hasLoaded = false

    this.state = {
      height: 0,
      width: 0
    }

    // oddly needs to happen here as unmount can happen AFTER a new instance has mounted :s
    PubSub.unsubscribe('CORE_ACCESS')
    PubSub.unsubscribe('RESET_CORE')

    PubSub.subscribe('CORE_ACCESS', (msg, data) => {
      this.messages = this.messages.concat(data)
    })

    PubSub.subscribe('RESET_CORE', (msg, data) => {
      this.messages = []
      this.init()
    })

  }

  init() {

    this.calculateCoreDimensions()

    this.renderGrid()

    this.republish()

  }

  calculateCoreDimensions() {
    const width = this.canvasContainer.clientWidth
    const height = this.canvasContainer.clientHeight

    // we get a brief period of zero values when switching display mode, during unmount/mount
    if (width === 0 && height === 0) {
      return
    }

    this.setState({
      width: width,
      height: height
    })

    this.containerWidth = width
    this.containerHeight = height

    this.cellSize = this.calculateCellSize()
    this.cellsWide = Math.floor(this.containerWidth / this.cellSize)
    this.cellsHigh = Math.floor(this.containerHeight / this.cellSize)
  }

  componentDidMount() {

    this.init()

    this.interactiveCanvas.addEventListener("click", e => this.canvasClick(e))

    window.addEventListener('resize', () => this.redraw())

    window.requestAnimationFrame(() => this.renderMessages())

  }

  componentDidUpdate(prevProps) {
    // if we got a new set of core options and the coreSize changed we need to redraw
    // the grid with new cell sizes
    if (this.props.coreSize !== prevProps.coreSize || !this.hasLoaded) {
      this.hasLoaded = true
      this.init()
    }
  }

  redraw() {
    this.init()
  }

  renderGrid() {
    this.clearCanvas()

    this.clearInteractiveCanvas()

    this.fillGridArea()

    this.renderGridLines()

    this.greyOutExtraCells()
  }

  addressToScreenCoordinate(address) {

    const ix = address % this.cellsWide
    const iy = Math.floor(address / this.cellsWide)

    return {
      x: ix * this.cellSize,
      y: iy * this.cellSize
    }
  }

  renderMessages() {

    // this.messages.forEach((data) => {
    //   this.renderCell(data)
    // })

    const warriorIds = [...new Set(this.messages.map(m => m.warriorId))]

    for(let i = 0; i < warriorIds.length; i++) {

      this.renderWarriorMessages(warriorIds[i])
    }

    this.messages = []

    window.requestAnimationFrame(() => this.renderMessages())
  }

  renderWarriorMessages(warriorId) {

    const warriorMessages = this.messages.filter(m => m.warriorId == warriorId)
    const colour = this.getColour(warriorId)
    
    this.coreContext.fillStyle = colour
    this.coreContext.strokeStyle = colour

    this.renderReads(warriorMessages)
    this.renderWrites(warriorMessages)
    this.renderExecutes(warriorMessages)
  }

  renderReads(warriorMessages) {

    const reads = warriorMessages.filter(m => m.accessType === accessType.read)
    reads.forEach(read => {
      
      const coordinate = this.addressToScreenCoordinate(read.address)
      
      this.renderRead(coordinate)
    })
  }

  renderWrites(warriorMessages) {

    const writes = warriorMessages.filter(m => m.accessType === accessType.write)
    writes.forEach(write => {
      
      const coordinate = this.addressToScreenCoordinate(write.address)
      
      this.renderWrite(coordinate)
    })
  }

  renderExecutes(warriorMessages) {
    
    const executes = warriorMessages.filter(m => m.accessType === accessType.execute)
    executes.forEach(execute => {
      
      const coordinate = this.addressToScreenCoordinate(execute.address)
      
      this.renderExecute(coordinate)
    })
  }

  renderCurrentTask(coordinate) {

    if (this.lastCoordinates) {

      this.interactiveContext.clearRect(
        this.lastCoordinates.x,
        this.lastCoordinates.y,
        this.lastCoordinates.wh,
        this.lastCoordinates.wh)
    }

    this.interactiveContext.fillStyle = colour.white

    this.interactiveContext.fillRect(
      coordinate.x,
      coordinate.y,
      this.cellSize,
      this.cellSize)

    this.lastCoordinates = {
      x: coordinate.x,
      y: coordinate.y - 1,
      wh: this.cellSize + 2
    }

  }

  screenCoordinateToAddress(point) {

    const x = Math.floor(point.x / this.cellSize)
    const y = Math.floor(point.y / this.cellSize)

    return y * this.cellsWide + x
  }

  getColour(warriorId) {
    return colour.warrior[warriorId % colour.warrior.length]
  }

  renderExecute(coordinate) {

    this.coreContext.fillRect(
      coordinate.x,
      coordinate.y,
      this.cellSize,
      this.cellSize)

    this.renderCurrentTask(coordinate)
  }

  renderRead(coordinate) {

    const hSize = this.cellSize / 2
    const radius = this.cellSize / 8

    const centre = {
      x: coordinate.x + hSize,
      y: coordinate.y + hSize
    }

    this.coreContext.beginPath()
    this.coreContext.arc(centre.x, centre.y, radius, 0, 2 * Math.PI, false)
    this.coreContext.fill()
  }

  renderWrite(coordinate) {

    const x0 = coordinate.x
    const y0 = coordinate.y

    const x1 = x0 + this.cellSize
    const y1 = y0 + this.cellSize

    this.coreContext.beginPath()
    this.coreContext.moveTo(x0, y0)
    this.coreContext.lineTo(x1, y1)
    this.coreContext.moveTo(x0, y1)
    this.coreContext.lineTo(x1, y0)
    this.coreContext.moveTo(x0, y0)
    this.coreContext.stroke()
  }

  clearCanvas() {

    this.coreContext.setTransform(1, 0, 0, 1, 0, 0)
    this.coreContext.clearRect(0, 0, this.containerWidth, this.containerHeight)
    this.coreContext.setTransform(1, 0, 0, 1, 0.5, 0.5)

  }

  clearInteractiveCanvas() {
    this.interactiveContext.setTransform(1, 0, 0, 1, 0, 0)
    this.interactiveContext.clearRect(0, 0, this.containerWidth, this.containerHeight)
    this.interactiveContext.setTransform(1, 0, 0, 1, 0.5, 0.5)
  }

  fillGridArea() {

    const width = this.cellsWide * this.cellSize
    const height = this.cellsHigh * this.cellSize

    this.coreContext.fillStyle = colour.defaultbg
    this.coreContext.fillRect(0, 0, width, height)

  }

  calculateCellSize() {

    const area = this.containerWidth * this.containerHeight
    const n = this.props.coreSize

    const maxCellSize = Math.sqrt(area / n)
    let possibleCellSize = Math.floor(maxCellSize)

    while (!this.isValidCellSize(possibleCellSize)) {

      possibleCellSize--
    }

    return possibleCellSize
  }

  isValidCellSize(cellSize) {
    const cellsWide = Math.floor(this.containerWidth / cellSize)
    const cellsHigh = Math.floor(this.containerHeight / cellSize)

    return cellsWide * cellsHigh >= this.props.coreSize
  }

  renderGridLines() {

    this.coreContext.beginPath()
    this.renderVerticalLines()
    this.renderHorizontalLines()

    this.coreContext.strokeStyle = colour.grey
    this.coreContext.stroke()
  }

  renderHorizontalLines() {

    const gridWidth = this.cellsWide * this.cellSize
    const gridHeight = this.cellsHigh * this.cellSize

    for (let y = 0; y <= gridHeight; y += this.cellSize) {

      this.coreContext.moveTo(0, y)
      this.coreContext.lineTo(gridWidth, y)
    }
  }

  renderVerticalLines() {

    const gridWidth = this.cellsWide * this.cellSize
    const gridHeight = this.cellsHigh * this.cellSize

    for (let x = 0; x <= gridWidth; x += this.cellSize) {

      this.coreContext.moveTo(x, 0)
      this.coreContext.lineTo(x, gridHeight)
    }
  }

  greyOutExtraCells() {

    const cellsDrawn = this.cellsWide * this.cellsHigh
    let extraCellsDrawn = cellsDrawn - this.props.coreSize

    if (extraCellsDrawn === 0) {
      return
    }

    const gridWidth = this.cellsWide * this.cellSize
    const gridHeight = this.cellsHigh * this.cellSize

    const maxX = gridWidth - this.cellSize
    const maxY = gridHeight - this.cellSize

    let x = maxX
    let y = maxY

    this.coreContext.fillStyle = colour.defaultbg

    while (extraCellsDrawn-- > 0) {

      this.coreContext.fillRect(x, y, this.cellSize + 1, this.cellSize + 1)

      x -= this.cellSize

      if (x < 0) {
        x = maxX
        y -= this.cellSize
      }
    }
  }

  getRelativeCoordinates(event) {

    let totalOffsetX = 0
    let totalOffsetY = 0
    let currentElement = event.target

    do {
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft
      totalOffsetY += currentElement.offsetTop - currentElement.scrollTop
    }
    while (currentElement = currentElement.offsetParent)

    const canvasX = (event.pageX - totalOffsetX) - 2
    const canvasY = (event.pageY - totalOffsetY) - 2

    return { x: canvasX, y: canvasY }
  }

  canvasClick(e) {

    if (!this.props.isInitialised) {
      return
    }

    this.clearInteractiveCanvas()

    const point = this.getRelativeCoordinates(e)

    const address = this.screenCoordinateToAddress(point)

    this.highlightClickPoint(point, address)

    this.getCoreInstructions(address)
  }

  highlightClickPoint(point, address) {

    const cell = this.addressToScreenCoordinate(address)

    const { x, y } = cell

    //this.interactiveContext.beginPath()

    this.interactiveContext.strokeStyle = '#ffffff'

    this.interactiveContext.strokeRect(x, y, this.cellSize, this.cellSize)

    // this.interactiveContext.moveTo(x, y)

    // this.interactiveContext.lineTo(x + this.cellSize, y)
    // this.interactiveContext.lineTo(x + this.cellSize, y + this.cellSize)
    // this.interactiveContext.lineTo(x, y + this.cellSize)
    // this.interactiveContext.lineTo(x, y)

    //this.interactiveContext.stroke()

  }

  render() {

    return <div id="canvasContainer"
      ref={(canvasContainer) => {
        if (canvasContainer == null) { return }
        this.canvasContainer = canvasContainer
      }}>
      <canvas
        ref={(coreCanvasEl) => {
          if (coreCanvasEl == null) { return }
          this.coreContext = coreCanvasEl.getContext("2d")
          this.coreCanvas = coreCanvasEl
        }}
        height={this.state.height}
        width={this.state.width}
      ></canvas>
      <canvas
        ref={(interactiveCanvasEl) => {
          if (interactiveCanvasEl == null) { return }
          this.interactiveContext = interactiveCanvasEl.getContext("2d")
          this.interactiveCanvas = interactiveCanvasEl
        }}
        height={this.state.height}
        width={this.state.width}
      ></canvas>
    </div>
  }

}

CanvasCore.PropTypes = {
  coreSize: PropTypes.number.isRequired,
  getCoreInstructions: PropTypes.func.isRequired,
  reset: PropTypes.func.isRequired,
  republish: PropTypes.func.isRequired
}

export default CanvasCore