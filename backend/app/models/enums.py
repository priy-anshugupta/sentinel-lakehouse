from enum import Enum

class TransactionType(str, Enum):
    PAYMENT = "PAYMENT"
    TRANSFER = "TRANSFER"
    CASH_OUT = "CASH_OUT"
    DEBIT = "DEBIT"
    CASH_IN = "CASH_IN"

class OlapOperation(str, Enum):
    ROLLUP = "ROLLUP"
    DRILLDOWN = "DRILLDOWN"
    SLICE = "SLICE"
    DICE = "DICE"
    PIVOT = "PIVOT"

class Granularity(str, Enum):
    HOUR = "HOUR"
    DAY = "DAY"
    WEEK = "WEEK"

class StreamState(str, Enum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"

class DriftStatus(str, Enum):
    EMERGED = "EMERGED"
    EXTINCT = "EXTINCT"
    SHIFTED = "SHIFTED"

class StreamAction(str, Enum):
    START = "START"
    PAUSE = "PAUSE"
    RESET = "RESET"
    INJECT = "INJECT"
    SET_SPEED = "SET_SPEED"
