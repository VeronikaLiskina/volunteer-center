class AnimalError(Exception):
    """Domain failure mapped to an HTTP response at the API boundary."""

    def __init__(self, message: str, status_code: int, field: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.field = field


class VolunteerError(Exception):
    """Expected volunteer-domain failure mapped at the API boundary."""

    def __init__(self, message: str, status_code: int, field: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.field = field


class CareProcedureError(Exception):
    def __init__(self, message: str, status_code: int, field: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.field = field


class ProcedureExecutionError(Exception):
    def __init__(self, message: str, status_code: int, field: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.field = field
