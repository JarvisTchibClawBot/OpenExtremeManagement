package extremeapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client is the Extreme Networks API client
type Client struct {
	BaseURL    string
	Username   string
	Password   string
	HTTPClient *http.Client
}

// NewClient creates a new Extreme Networks API client
func NewClient(baseURL, username, password string) *Client {
	return &Client{
		BaseURL:  baseURL,
		Username: username,
		Password: password,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetSystemInfo retrieves system information from the switch
func (c *Client) GetSystemInfo() (map[string]interface{}, error) {
	// TODO: Implement actual API call
	return nil, fmt.Errorf("not implemented")
}

// GetPorts retrieves port information from the switch
func (c *Client) GetPorts() ([]map[string]interface{}, error) {
	// TODO: Implement actual API call
	return nil, fmt.Errorf("not implemented")
}

// GetConfig retrieves the running configuration
func (c *Client) GetConfig() (string, error) {
	// TODO: Implement actual API call
	return "", fmt.Errorf("not implemented")
}

// doRequest performs an HTTP request to the switch API
func (c *Client) doRequest(method, path string, body interface{}) (*http.Response, error) {
	url := fmt.Sprintf("%s%s", c.BaseURL, path)
	
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, err
	}

	req.SetBasicAuth(c.Username, c.Password)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	return c.HTTPClient.Do(req)
}

// parseResponse parses a JSON response
func parseResponse(resp *http.Response, v interface{}) error {
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(v)
}
