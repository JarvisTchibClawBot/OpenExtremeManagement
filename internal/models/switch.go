package models

import (
	"time"
)

type Switch struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"not null"`
	IPAddress   string    `json:"ip_address" gorm:"uniqueIndex;not null"`
	Model       string    `json:"model"`
	Firmware    string    `json:"firmware"`
	Username    string    `json:"username"`
	Password    string    `json:"-"` // Never expose password in JSON
	LastSeen    time.Time `json:"last_seen"`
	Status      string    `json:"status"` // online, offline, unknown
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Port struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	SwitchID  uint   `json:"switch_id"`
	Name      string `json:"name"`
	Status    string `json:"status"` // up, down
	Speed     string `json:"speed"`
	VLAN      int    `json:"vlan"`
}

type ConfigBackup struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	SwitchID  uint      `json:"switch_id"`
	Config    string    `json:"config" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
}
