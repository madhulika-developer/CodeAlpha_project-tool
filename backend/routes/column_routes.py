from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend.models import BoardColumn, Project
from backend.schemas import ColumnCreate, ColumnUpdate
from backend.auth import get_current_user
from backend.websocket_manager import manager
from backend.routes.project_routes import verify_project_access

router = APIRouter(tags=["columns"])

@router.post("/api/projects/{project_id}/columns")
async def create_column(project_id: int, req: ColumnCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    verify_project_access(project_id, current_user.id, db)

    # Calculate next order if not supplied
    if req.order is None:
        last_col = db.query(BoardColumn).filter(
            BoardColumn.project_id == project_id
        ).order_by(BoardColumn.order.desc()).first()
        order = (last_col.order + 1) if last_col else 0
    else:
        order = req.order

    col = BoardColumn(
        project_id=project_id,
        name=req.name,
        color=req.color or "#64748B",
        order=order
    )
    db.add(col)
    db.commit()
    db.refresh(col)

    data = col.to_dict()
    await manager.broadcast_to_project(project_id, "column_created", data)
    return data

@router.put("/api/columns/{column_id}")
async def update_column(column_id: int, req: ColumnUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    col = db.query(BoardColumn).filter(BoardColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")

    verify_project_access(col.project_id, current_user.id, db)

    if req.name is not None:
        col.name = req.name
    if req.color is not None:
        col.color = req.color
    if req.order is not None:
        col.order = req.order

    db.commit()
    db.refresh(col)

    data = col.to_dict()
    await manager.broadcast_to_project(col.project_id, "column_updated", data)
    return data

@router.delete("/api/columns/{column_id}")
async def delete_column(column_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    col = db.query(BoardColumn).filter(BoardColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")

    project_id = col.project_id
    verify_project_access(project_id, current_user.id, db)

    db.delete(col)
    db.commit()

    await manager.broadcast_to_project(project_id, "column_deleted", {"column_id": column_id})
    return {"message": "Column deleted successfully"}

@router.post("/api/projects/{project_id}/columns/reorder")
async def reorder_columns(project_id: int, column_ids: List[int], db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    verify_project_access(project_id, current_user.id, db)

    for index, col_id in enumerate(column_ids):
        col = db.query(BoardColumn).filter(
            BoardColumn.id == col_id,
            BoardColumn.project_id == project_id
        ).first()
        if col:
            col.order = index

    db.commit()
    await manager.broadcast_to_project(project_id, "columns_reordered", {"column_ids": column_ids})
    return {"message": "Columns reordered"}
